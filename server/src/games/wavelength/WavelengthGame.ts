import type {
  GameAction,
  WavelengthActionType,
  WavelengthGuess,
  WavelengthPhase,
  WavelengthPrivateState,
  WavelengthPublicState,
  WavelengthRoundResult,
} from "../../protocol/messages.ts";
import { GameError, type Game } from "../Game.ts";
import { pickSpectrum, randomTarget } from "./spectrums.ts";
import { scoreRound } from "./scoring.ts";

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 10;
const MAX_CLUE_LENGTH = 40;

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = next[i];
    const b = next[j];
    if (a === undefined || b === undefined) {
      continue;
    }
    next[i] = b;
    next[j] = a;
  }
  return next;
}

function cloneGuesses(guesses: WavelengthGuess[]): WavelengthGuess[] {
  return guesses.map((guess) => ({ ...guess }));
}

export class WavelengthGame implements Game {
  private phase: WavelengthPhase = "CLUE";
  private active = new Set<string>();
  private turnOrder: string[] = [];
  private roundIndex = 0;
  private leftLabel = "";
  private rightLabel = "";
  private target = 0;
  private clue: string | null = null;
  private guesses = new Map<string, number>();
  private history: WavelengthRoundResult[] = [];
  private totalScore = 0;
  private lastReveal: WavelengthRoundResult | null = null;
  private usedSpectrumIndices = new Set<number>();

  canStart(playerCount: number): string | null {
    if (playerCount < MIN_PLAYERS) {
      return `Wavelength needs at least ${MIN_PLAYERS} players`;
    }
    if (playerCount > MAX_PLAYERS) {
      return `Wavelength supports at most ${MAX_PLAYERS} players`;
    }
    return null;
  }

  setup(playerIds: string[]): void {
    this.active = new Set(playerIds);
    this.turnOrder = shuffle(playerIds);
    this.roundIndex = 0;
    this.history = [];
    this.totalScore = 0;
    this.lastReveal = null;
    this.usedSpectrumIndices = new Set();
    this.phase = "CLUE";
    this.startRound();
  }

  getPublicState(): WavelengthPublicState {
    const state: WavelengthPublicState = {
      kind: "wavelength",
      phase: this.phase,
      round: this.roundIndex + 1,
      totalRounds: this.turnOrder.length,
      clueGiverId: this.currentClueGiver(),
      leftLabel: this.leftLabel,
      rightLabel: this.rightLabel,
      clue: this.clue,
      submittedGuesserIds: [...this.guesses.keys()],
      totalScore: this.totalScore,
    };
    if (this.lastReveal) {
      state.lastReveal = this.cloneRoundResult(this.lastReveal);
    }
    if (this.history.length > 0) {
      state.history = this.history.map((round) => this.cloneRoundResult(round));
    }
    if (this.phase === "RESULTS") {
      return state;
    }
    return state;
  }

  getPrivateState(playerId: string): WavelengthPrivateState {
    const isClueGiver = this.currentClueGiver() === playerId;
    const state: WavelengthPrivateState = {
      kind: "wavelength",
      role: isClueGiver ? "clueGiver" : "guesser",
      legalActions: this.legalActions(playerId),
    };
    if (isClueGiver && !this.isGameOver()) {
      return { ...state, target: this.target };
    }
    const myGuess = this.guesses.get(playerId);
    if (myGuess !== undefined) {
      return { ...state, myGuess };
    }
    return state;
  }

  performAction(playerId: string, action: GameAction): void {
    if (!this.active.has(playerId)) {
      throw new GameError("You are not in this game");
    }
    if (this.isGameOver()) {
      throw new GameError("The game is over");
    }
    switch (action.type) {
      case "submit_clue":
        this.submitClue(playerId, action.clue);
        return;
      case "submit_spectrum_guess":
        this.submitGuess(playerId, action.position);
        return;
      default:
        throw new GameError("That action is not valid in this game");
    }
  }

  onPlayerRemoved(playerId: string): void {
    if (this.isGameOver() || !this.active.has(playerId)) {
      return;
    }
    this.active.delete(playerId);
    this.turnOrder = this.turnOrder.filter((id) => id !== playerId);
    this.guesses.delete(playerId);

    if (this.active.size < MIN_PLAYERS) {
      this.phase = "ABORTED";
      this.clue = null;
      this.guesses.clear();
      return;
    }

    if (this.turnOrder.length === 0) {
      this.phase = "ABORTED";
      return;
    }

    if (this.roundIndex >= this.turnOrder.length) {
      this.phase = "RESULTS";
      return;
    }

    if (this.currentClueGiver() === playerId) {
      this.clue = null;
      this.guesses.clear();
      if (this.roundIndex >= this.turnOrder.length) {
        this.phase = "RESULTS";
        return;
      }
      this.startRound();
    }
  }

  isGameOver(): boolean {
    return this.phase === "RESULTS" || this.phase === "ABORTED";
  }

  getTimerDeadline(): number | null {
    return null;
  }

  onTimer(): void {
    // Wavelength has no timer in this implementation.
  }

  private submitClue(playerId: string, clue: string): void {
    if (this.phase !== "CLUE") {
      throw new GameError("It is not time to give a clue");
    }
    if (this.currentClueGiver() !== playerId) {
      throw new GameError("Only the clue-giver can submit a clue");
    }
    const trimmed = clue.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_CLUE_LENGTH) {
      throw new GameError(`Clue must be 1–${MAX_CLUE_LENGTH} characters`);
    }
    this.clue = trimmed;
    this.phase = "GUESSING";
  }

  private submitGuess(playerId: string, position: number): void {
    if (this.phase !== "GUESSING") {
      throw new GameError("It is not time to guess");
    }
    if (this.currentClueGiver() === playerId) {
      throw new GameError("The clue-giver cannot submit a guess");
    }
    if (!this.clue) {
      throw new GameError("Wait for a clue before guessing");
    }
    if (this.guesses.has(playerId)) {
      throw new GameError("You already submitted a guess");
    }
    if (!Number.isInteger(position) || position < 0 || position > 100) {
      throw new GameError("Guess must be an integer from 0 to 100");
    }
    this.guesses.set(playerId, position);
    if (this.allGuessersSubmitted()) {
      this.completeRound();
    }
  }

  private completeRound(): void {
    const clueGiverId = this.currentClueGiver();
    if (!clueGiverId || !this.clue) {
      throw new GameError("Round cannot complete");
    }
    const guesses: WavelengthGuess[] = [...this.guesses.entries()].map(
      ([guessPlayerId, guessPosition]) => ({
        playerId: guessPlayerId,
        position: guessPosition,
      }),
    );
    const { guessScores, roundScore } = scoreRound(this.target, guesses);
    const roundResult: WavelengthRoundResult = {
      round: this.roundIndex + 1,
      clueGiverId,
      leftLabel: this.leftLabel,
      rightLabel: this.rightLabel,
      target: this.target,
      clue: this.clue,
      guesses: cloneGuesses(guesses),
      guessScores,
      roundScore,
    };
    this.history.push(roundResult);
    this.totalScore += roundScore;
    this.lastReveal = roundResult;

    if (this.roundIndex >= this.turnOrder.length - 1) {
      this.phase = "RESULTS";
      this.clue = null;
      this.guesses.clear();
      return;
    }

    this.roundIndex += 1;
    this.startRound();
  }

  private startRound(): void {
    const picked = pickSpectrum(this.usedSpectrumIndices);
    this.usedSpectrumIndices.add(picked.index);
    this.leftLabel = picked.pair.leftLabel;
    this.rightLabel = picked.pair.rightLabel;
    this.target = randomTarget();
    this.clue = null;
    this.guesses.clear();
    this.phase = "CLUE";
  }

  private currentClueGiver(): string {
    return this.turnOrder[this.roundIndex] ?? "";
  }

  private guesserIds(): string[] {
    const clueGiverId = this.currentClueGiver();
    return this.turnOrder.filter((id) => id !== clueGiverId && this.active.has(id));
  }

  private allGuessersSubmitted(): boolean {
    const expected = this.guesserIds();
    return expected.length > 0 && expected.every((id) => this.guesses.has(id));
  }

  private legalActions(playerId: string): WavelengthActionType[] {
    if (this.phase === "CLUE" && this.currentClueGiver() === playerId) {
      return ["submit_clue"];
    }
    if (
      this.phase === "GUESSING" &&
      this.currentClueGiver() !== playerId &&
      this.clue &&
      !this.guesses.has(playerId)
    ) {
      return ["submit_spectrum_guess"];
    }
    return [];
  }

  private cloneRoundResult(round: WavelengthRoundResult): WavelengthRoundResult {
    return {
      ...round,
      guesses: cloneGuesses(round.guesses),
      guessScores: { ...round.guessScores },
    };
  }
}
