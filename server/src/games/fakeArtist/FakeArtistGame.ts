import type {
  FakeArtistActionType,
  FakeArtistPhase,
  FakeArtistPrivateState,
  FakeArtistPublicState,
  FakeArtistVote,
  FakeArtistWinner,
  GameAction,
  Stroke,
  StrokePoint,
} from "../../protocol/messages.ts";
import { GameError, type Game } from "../Game.ts";
import { deadlineFromNow } from "../phaseTimer.ts";
import { pickPrompt } from "./words.ts";

const MAX_STROKE_POINTS = 500;
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 10;
const ROUNDS = 2;
/** One stroke per turn — short enough to keep the canvas moving. */
const DRAW_TURN_MS = 20_000;

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

export class FakeArtistGame implements Game {
  private phase: FakeArtistPhase = "DRAWING";
  private players = new Set<string>();
  private turnOrder: string[] = [];
  private turnQueue: string[] = [];
  private turnIndex = 0;
  private fakeArtistId = "";
  private word = "";
  private category = "";
  private strokes: Stroke[] = [];
  private votes = new Map<string, string>();
  private winner: FakeArtistWinner | null = null;
  private endsAt: number | null = null;

  canStart(playerCount: number): string | null {
    if (playerCount < MIN_PLAYERS) {
      return `Fake Artist needs at least ${MIN_PLAYERS} players`;
    }
    if (playerCount > MAX_PLAYERS) {
      return `Fake Artist supports at most ${MAX_PLAYERS} players`;
    }
    return null;
  }

  setup(playerIds: string[]): void {
    this.players = new Set(playerIds);
    this.turnOrder = shuffle(playerIds);
    this.turnQueue = [];
    for (let round = 0; round < ROUNDS; round += 1) {
      this.turnQueue.push(...this.turnOrder);
    }
    this.turnIndex = 0;
    const fakeIndex = Math.floor(Math.random() * this.turnOrder.length);
    this.fakeArtistId = this.turnOrder[fakeIndex] ?? playerIds[0] ?? "";
    const prompt = pickPrompt();
    this.word = prompt.word;
    this.category = prompt.category;
    this.strokes = [];
    this.votes = new Map();
    this.winner = null;
    this.phase = "DRAWING";
    this.startDrawTurnTimer();
  }

  getPublicState(): FakeArtistPublicState {
    const state: FakeArtistPublicState = {
      kind: "fakeArtist",
      phase: this.phase,
      category: this.category,
      turnOrder: [...this.turnOrder],
      currentPlayerId: this.currentPlayerId(),
      round: this.currentRound(),
      strokes: this.strokes.map((stroke) => ({
        playerId: stroke.playerId,
        points: stroke.points.map((point) => ({ x: point.x, y: point.y })),
      })),
      votedPlayerIds: [...this.votes.keys()],
    };
    if (this.endsAt !== null && this.phase === "DRAWING") {
      state.endsAt = this.endsAt;
    }
    if (this.phase === "RESULTS" || this.phase === "ABORTED") {
      return {
        ...state,
        fakeArtistId: this.fakeArtistId,
        word: this.word,
        votes: this.revealedVotes(),
        winner: this.winner ?? "aborted",
      };
    }
    return state;
  }

  getPrivateState(playerId: string): FakeArtistPrivateState {
    const isFake = playerId === this.fakeArtistId;
    const state: FakeArtistPrivateState = {
      kind: "fakeArtist",
      role: isFake ? "fakeArtist" : "artist",
      category: this.category,
      legalActions: this.legalActions(playerId),
    };
    if (!isFake) {
      return { ...state, word: this.word };
    }
    return state;
  }

  performAction(playerId: string, action: GameAction): void {
    if (!this.players.has(playerId)) {
      throw new GameError("You are not in this game");
    }
    switch (action.type) {
      case "submit_stroke":
        this.submitStroke(playerId, action.points);
        return;
      case "vote":
        this.castVote(playerId, action.targetPlayerId);
        return;
      case "guess_word":
        this.guessWord(playerId, action.word);
        return;
      default:
        throw new GameError("That action is not valid in this game");
    }
  }

  onPlayerRemoved(playerId: string): void {
    if (this.isGameOver() || !this.players.has(playerId)) {
      return;
    }
    if (playerId === this.fakeArtistId) {
      this.abort();
      return;
    }
    this.players.delete(playerId);
    this.turnOrder = this.turnOrder.filter((id) => id !== playerId);
    this.votes.delete(playerId);
    const remaining = this.turnQueue
      .slice(this.turnIndex)
      .filter((id) => id !== playerId);
    this.turnQueue = this.turnQueue.slice(0, this.turnIndex).concat(remaining);

    if (this.players.size < MIN_PLAYERS) {
      this.abort();
      return;
    }

    if (this.phase === "DRAWING" && this.turnIndex >= this.turnQueue.length) {
      this.startVoting();
      return;
    }
    if (this.phase === "VOTING" && this.allVotesIn()) {
      this.resolveVotes();
    }
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
    // Same transition as submitting a stroke: advance the turn queue.
    this.turnIndex += 1;
    if (this.turnIndex >= this.turnQueue.length) {
      this.startVoting();
      return;
    }
    this.startDrawTurnTimer();
  }

  private submitStroke(playerId: string, points: StrokePoint[]): void {
    if (this.phase !== "DRAWING") {
      throw new GameError("It is not time to draw");
    }
    if (this.currentPlayerId() !== playerId) {
      throw new GameError("It is not your turn to draw");
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
    this.turnIndex += 1;
    if (this.turnIndex >= this.turnQueue.length) {
      this.startVoting();
      return;
    }
    this.startDrawTurnTimer();
  }

  private castVote(playerId: string, targetPlayerId: string): void {
    if (this.phase !== "VOTING") {
      throw new GameError("It is not time to vote");
    }
    if (this.votes.has(playerId)) {
      throw new GameError("You have already voted");
    }
    if (targetPlayerId === playerId) {
      throw new GameError("You cannot vote for yourself");
    }
    if (!this.players.has(targetPlayerId)) {
      throw new GameError("That player is not in the game");
    }
    this.votes.set(playerId, targetPlayerId);
    if (this.allVotesIn()) {
      this.resolveVotes();
    }
  }

  private guessWord(playerId: string, word: string): void {
    if (this.phase !== "GUESS") {
      throw new GameError("It is not time to guess");
    }
    if (playerId !== this.fakeArtistId) {
      throw new GameError("Only the Fake Artist can guess");
    }
    const guessed = normalizeWord(word);
    if (guessed.length === 0) {
      throw new GameError("Guess cannot be empty");
    }
    this.winner =
      guessed === normalizeWord(this.word) ? "artists" : "fakeArtist";
    this.phase = "RESULTS";
    this.endsAt = null;
  }

  private startVoting(): void {
    this.phase = "VOTING";
    this.votes = new Map();
    this.endsAt = null;
  }

  private allVotesIn(): boolean {
    for (const playerId of this.players) {
      if (!this.votes.has(playerId)) {
        return false;
      }
    }
    return this.players.size > 0;
  }

  private resolveVotes(): void {
    const tallies = new Map<string, number>();
    for (const targetId of this.votes.values()) {
      tallies.set(targetId, (tallies.get(targetId) ?? 0) + 1);
    }
    let bestCount = 0;
    for (const count of tallies.values()) {
      if (count > bestCount) {
        bestCount = count;
      }
    }
    const accused = [...tallies.entries()]
      .filter(([, count]) => count === bestCount)
      .map(([id]) => id);
    this.endsAt = null;
    if (accused.length === 1 && accused[0] === this.fakeArtistId) {
      this.phase = "GUESS";
      return;
    }
    this.winner = "fakeArtist";
    this.phase = "RESULTS";
  }

  private abort(): void {
    this.phase = "ABORTED";
    this.winner = "aborted";
    this.endsAt = null;
  }

  private startDrawTurnTimer(): void {
    this.endsAt = deadlineFromNow(DRAW_TURN_MS);
  }

  private currentPlayerId(): string | null {
    if (this.phase !== "DRAWING") {
      return null;
    }
    return this.turnQueue[this.turnIndex] ?? null;
  }

  private currentRound(): number {
    if (this.turnOrder.length === 0) {
      return 1;
    }
    return Math.min(ROUNDS, Math.floor(this.turnIndex / this.turnOrder.length) + 1);
  }

  private legalActions(playerId: string): FakeArtistActionType[] {
    if (this.phase === "DRAWING" && this.currentPlayerId() === playerId) {
      return ["submit_stroke"];
    }
    if (this.phase === "VOTING" && !this.votes.has(playerId)) {
      return ["vote"];
    }
    if (this.phase === "GUESS" && playerId === this.fakeArtistId) {
      return ["guess_word"];
    }
    return [];
  }

  private revealedVotes(): FakeArtistVote[] {
    return [...this.votes.entries()].map(([voterId, targetPlayerId]) => ({
      voterId,
      targetPlayerId,
    }));
  }
}
