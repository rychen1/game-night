import type {
  GameAction,
  PictionaryActionType,
  PictionaryGuess,
  PictionaryLastRound,
  PictionaryPhase,
  PictionaryPrivateState,
  PictionaryPublicState,
  PictionaryRoundResult,
  Stroke,
  StrokePoint,
} from "../../protocol/messages.ts";
import { GameError, type Game } from "../Game.ts";
import { deadlineFromNow } from "../phaseTimer.ts";
import { pickWord } from "./words.ts";

const MAX_STROKE_POINTS = 500;
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 10;
/** Full draw+guess round for one drawer — longer party-game window. */
const DRAWING_ROUND_MS = 90_000;

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

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizeWord(word: string): string {
  return word.trim().toLowerCase().replace(/\s+/g, " ");
}

function cloneStrokes(strokes: Stroke[]): Stroke[] {
  return strokes.map((stroke) => ({
    playerId: stroke.playerId,
    points: stroke.points.map((point) => ({ x: point.x, y: point.y })),
  }));
}

export class PictionaryGame implements Game {
  private phase: PictionaryPhase = "DRAWING";
  private active = new Set<string>();
  private remainingToDraw: string[] = [];
  private drawn = new Set<string>();
  private word = "";
  private strokes: Stroke[] = [];
  private guesses: PictionaryGuess[] = [];
  private lastRound: PictionaryLastRound | null = null;
  private history: PictionaryRoundResult[] = [];
  private endsAt: number | null = null;

  canStart(playerCount: number): string | null {
    if (playerCount < MIN_PLAYERS) {
      return `Pictionary needs at least ${MIN_PLAYERS} players`;
    }
    if (playerCount > MAX_PLAYERS) {
      return `Pictionary supports at most ${MAX_PLAYERS} players`;
    }
    return null;
  }

  setup(playerIds: string[]): void {
    this.active = new Set(playerIds);
    this.remainingToDraw = shuffle(playerIds);
    this.drawn = new Set();
    this.strokes = [];
    this.guesses = [];
    this.lastRound = null;
    this.history = [];
    this.phase = "DRAWING";
    this.word = pickWord([]);
    this.startRoundTimer();
  }

  getPublicState(): PictionaryPublicState {
    const state: PictionaryPublicState = {
      kind: "pictionary",
      phase: this.phase,
      drawerId: this.currentDrawer(),
      round: this.roundNumber(),
      totalRounds: this.totalRounds(),
      strokes: cloneStrokes(this.strokes),
      guesses: this.guesses.map((guess) => ({ ...guess })),
      solved: false,
    };
    if (this.endsAt !== null && this.phase === "DRAWING") {
      state.endsAt = this.endsAt;
    }
    if (this.lastRound) {
      state.lastRound = { ...this.lastRound };
    }
    if (this.phase === "RESULTS") {
      return {
        ...state,
        history: this.history.map((round) => ({
          drawerId: round.drawerId,
          word: round.word,
          solverId: round.solverId,
          strokes: cloneStrokes(round.strokes),
          guesses: round.guesses.map((guess) => ({ ...guess })),
          ...(round.skipped ? { skipped: true } : {}),
        })),
      };
    }
    return state;
  }

  getPrivateState(playerId: string): PictionaryPrivateState {
    const isDrawer =
      this.phase === "DRAWING" && this.currentDrawer() === playerId;
    const state: PictionaryPrivateState = {
      kind: "pictionary",
      role: isDrawer ? "drawer" : "guesser",
      legalActions: this.legalActions(playerId),
    };
    if (isDrawer) {
      return { ...state, word: this.word };
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
      case "submit_stroke":
        this.submitStroke(playerId, action.points);
        return;
      case "submit_guess":
        this.submitGuess(playerId, action.text);
        return;
      default:
        throw new GameError("That action is not valid in this game");
    }
  }

  onPlayerRemoved(playerId: string): void {
    if (this.isGameOver() || !this.active.has(playerId)) {
      return;
    }
    const wasDrawer = this.currentDrawer() === playerId;
    this.active.delete(playerId);
    this.remainingToDraw = this.remainingToDraw.filter((id) => id !== playerId);
    this.drawn.delete(playerId);

    if (this.active.size < MIN_PLAYERS) {
      this.phase = "ABORTED";
      this.word = "";
      this.strokes = [];
      this.guesses = [];
      this.endsAt = null;
      return;
    }

    if (!wasDrawer) {
      return;
    }

    this.strokes = [];
    this.guesses = [];
    this.word = "";
    if (this.remainingToDraw.length === 0) {
      this.phase = "RESULTS";
      this.endsAt = null;
      return;
    }
    this.word = pickWord(this.excludeWords());
    this.phase = "DRAWING";
    this.startRoundTimer();
  }

  isGameOver(): boolean {
    return this.phase === "RESULTS" || this.phase === "ABORTED";
  }

  getTimerDeadline(): number | null {
    if (this.phase !== "DRAWING") {
      return null;
    }
    return this.endsAt;
  }

  onTimer(): void {
    if (this.phase !== "DRAWING" || this.endsAt === null) {
      return;
    }
    if (Date.now() < this.endsAt) {
      return;
    }
    // Unsolved: record a skipped slot for postgame, then continue (or RESULTS).
    const drawerId = this.currentDrawer();
    if (drawerId) {
      this.history.push({
        drawerId,
        word: this.word,
        solverId: "",
        strokes: cloneStrokes(this.strokes),
        guesses: this.guesses.map((guess) => ({ ...guess })),
        skipped: true,
      });
      this.remainingToDraw = this.remainingToDraw.filter((id) => id !== drawerId);
      this.drawn.add(drawerId);
    }
    this.strokes = [];
    this.guesses = [];
    this.word = "";
    if (this.remainingToDraw.length === 0) {
      this.phase = "RESULTS";
      this.endsAt = null;
      return;
    }
    this.word = pickWord(this.excludeWords());
    this.phase = "DRAWING";
    this.startRoundTimer();
  }

  private submitStroke(playerId: string, points: StrokePoint[]): void {
    if (this.phase !== "DRAWING") {
      throw new GameError("It is not time to draw");
    }
    if (this.currentDrawer() !== playerId) {
      throw new GameError("Only the drawer can draw");
    }
    if (points.length > MAX_STROKE_POINTS) {
      throw new GameError("Stroke is too long");
    }
    this.strokes.push({
      playerId,
      points: points.map((point) => ({
        x: clamp01(point.x),
        y: clamp01(point.y),
      })),
    });
  }

  private submitGuess(playerId: string, text: string): void {
    if (this.phase !== "DRAWING") {
      throw new GameError("It is not time to guess");
    }
    if (this.currentDrawer() === playerId) {
      throw new GameError("The drawer cannot guess");
    }
    const guessText = text.trim();
    if (guessText.length === 0 || guessText.length > 40) {
      throw new GameError("Guess must be 1–40 characters");
    }
    const correct = normalizeWord(guessText) === normalizeWord(this.word);
    this.guesses.push({ playerId, text: guessText, correct });
    if (!correct) {
      return;
    }
    this.completeRound(playerId);
  }

  private completeRound(solverId: string): void {
    const drawerId = this.currentDrawer();
    if (drawerId === null) {
      throw new GameError("No drawer");
    }
    const completedWord = this.word;
    this.lastRound = {
      word: completedWord,
      drawerId,
      solverId,
    };
    this.history.push({
      drawerId,
      word: completedWord,
      solverId,
      strokes: cloneStrokes(this.strokes),
      guesses: this.guesses.map((guess) => ({ ...guess })),
    });
    this.remainingToDraw = this.remainingToDraw.filter((id) => id !== drawerId);
    this.drawn.add(drawerId);
    this.strokes = [];
    this.guesses = [];
    if (this.remainingToDraw.length === 0) {
      this.word = "";
      this.phase = "RESULTS";
      this.endsAt = null;
      return;
    }
    this.word = pickWord(this.excludeWords());
    this.phase = "DRAWING";
    this.startRoundTimer();
  }

  private startRoundTimer(): void {
    this.endsAt = deadlineFromNow(DRAWING_ROUND_MS);
  }

  private currentDrawer(): string | null {
    if (this.phase !== "DRAWING") {
      return this.lastRound?.drawerId ?? null;
    }
    return this.remainingToDraw[0] ?? null;
  }

  private legalActions(playerId: string): PictionaryActionType[] {
    if (this.phase !== "DRAWING") {
      return [];
    }
    if (this.currentDrawer() === playerId) {
      return ["submit_stroke"];
    }
    return ["submit_guess"];
  }

  private roundNumber(): number {
    if (this.phase === "RESULTS") {
      return this.history.length;
    }
    return this.drawn.size + 1;
  }

  private totalRounds(): number {
    return this.drawn.size + this.remainingToDraw.length;
  }

  private excludeWords(): string[] {
    const excluded = [...this.history.map((round) => round.word)];
    if (this.lastRound) {
      excluded.push(this.lastRound.word);
    }
    return excluded;
  }
}
