import type {
  GameAction,
  Stroke,
  TelestrationsActionType,
  TelestrationsBook,
  TelestrationsPhase,
  TelestrationsPrivateState,
  TelestrationsPublicState,
  TelestrationsRevealedPage,
} from "../../protocol/messages.ts";
import { GameError, type Game } from "../Game.ts";
import { deadlineFromNow } from "../phaseTimer.ts";
import { pickPrompts } from "./prompts.ts";

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 10;
/** Simultaneous full drawings — longer than a single Fake Artist stroke. */
const DRAWING_ROUND_MS = 60_000;
/** Typing a guess from a drawing — shorter than drawing. */
const GUESSING_ROUND_MS = 35_000;
const TIMEOUT_GUESS = "(timed out)";

type PromptPage = { kind: "prompt"; authorId: string; text: string };
type DrawingPage = { kind: "drawing"; authorId: string; strokes: Stroke[] };
type GuessPage = { kind: "guess"; authorId: string; text: string };
type Page = PromptPage | DrawingPage | GuessPage;

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

function cloneStrokes(strokes: Stroke[], authorId: string): Stroke[] {
  return strokes.map((stroke) => ({
    playerId: authorId,
    points: stroke.points.map((point) => ({
      x: clamp01(point.x),
      y: clamp01(point.y),
    })),
  }));
}

export class TelestrationsGame implements Game {
  private phase: TelestrationsPhase = "DRAWING";
  private order: string[] = [];
  private round = 0;
  private books = new Map<string, Page[]>();
  private submitted = new Set<string>();
  private endsAt: number | null = null;

  canStart(playerCount: number): string | null {
    if (playerCount < MIN_PLAYERS) {
      return `Telestrations needs at least ${MIN_PLAYERS} players`;
    }
    if (playerCount > MAX_PLAYERS) {
      return `Telestrations supports at most ${MAX_PLAYERS} players`;
    }
    return null;
  }

  setup(playerIds: string[]): void {
    this.order = shuffle(playerIds);
    this.round = 0;
    this.submitted = new Set();
    this.phase = "DRAWING";
    this.books = new Map();
    const prompts = pickPrompts(this.order.length);
    this.order.forEach((playerId, index) => {
      this.books.set(playerId, [
        { kind: "prompt", authorId: playerId, text: prompts[index] ?? "Pizza" },
      ]);
    });
    this.startPhaseTimer();
  }

  getPublicState(): TelestrationsPublicState {
    const state: TelestrationsPublicState = {
      kind: "telestrations",
      phase: this.phase,
      round: this.round,
      totalRounds: this.order.length,
      playerOrder: [...this.order],
      submittedPlayerIds: [...this.submitted],
    };
    if (
      this.endsAt !== null &&
      (this.phase === "DRAWING" || this.phase === "GUESSING")
    ) {
      state.endsAt = this.endsAt;
    }
    if (this.phase === "REVEAL") {
      return { ...state, books: this.revealedBooks() };
    }
    return state;
  }

  getPrivateState(playerId: string): TelestrationsPrivateState {
    const submitted = this.submitted.has(playerId);
    const base = {
      kind: "telestrations" as const,
      phase: this.phase,
      round: this.round,
      totalRounds: this.order.length,
      submitted,
      legalActions: this.legalActions(playerId),
    };
    if (this.phase === "REVEAL" || this.phase === "ABORTED") {
      return { ...base, task: "reveal" };
    }
    const source = this.currentSourcePage(playerId);
    if (this.phase === "DRAWING" && source.kind === "prompt") {
      return { ...base, task: "draw", promptText: source.text };
    }
    if (this.phase === "DRAWING" && source.kind === "guess") {
      return { ...base, task: "draw", guessText: source.text };
    }
    if (this.phase === "GUESSING" && source.kind === "drawing") {
      return { ...base, task: "guess", strokes: cloneStrokes(source.strokes, source.authorId) };
    }
    return { ...base, task: "wait" };
  }

  performAction(playerId: string, action: GameAction): void {
    if (!this.order.includes(playerId)) {
      throw new GameError("You are not in this game");
    }
    if (this.isGameOver()) {
      throw new GameError("The round is over");
    }
    switch (action.type) {
      case "submit_drawing":
        this.submitDrawing(playerId, action.strokes);
        return;
      case "submit_guess":
        this.submitGuess(playerId, action.text);
        return;
      default:
        throw new GameError("That action is not valid in this game");
    }
  }

  onPlayerRemoved(_playerId: string): void {
    if (this.isGameOver()) {
      return;
    }
    this.phase = "ABORTED";
    this.endsAt = null;
  }

  isGameOver(): boolean {
    return this.phase === "REVEAL" || this.phase === "ABORTED";
  }

  getTimerDeadline(): number | null {
    if (this.phase !== "DRAWING" && this.phase !== "GUESSING") {
      return null;
    }
    return this.endsAt;
  }

  onTimer(): void {
    if (this.phase !== "DRAWING" && this.phase !== "GUESSING") {
      return;
    }
    if (this.endsAt === null || Date.now() < this.endsAt) {
      return;
    }
    // Complete the simultaneous round: fill missing submits, then advance.
    for (const playerId of this.order) {
      if (this.submitted.has(playerId)) {
        continue;
      }
      if (this.phase === "DRAWING") {
        this.forceDrawing(playerId);
      } else {
        this.forceGuess(playerId);
      }
    }
    this.advanceIfReady();
  }

  private submitDrawing(playerId: string, strokes: Stroke[]): void {
    if (this.phase !== "DRAWING") {
      throw new GameError("It is not time to draw");
    }
    if (this.submitted.has(playerId)) {
      throw new GameError("You have already submitted");
    }
    const source = this.currentSourcePage(playerId);
    if (source.kind !== "prompt" && source.kind !== "guess") {
      throw new GameError("You should be guessing, not drawing");
    }
    const book = this.bookFor(this.ownerIdFor(playerId));
    book.push({
      kind: "drawing",
      authorId: playerId,
      strokes: cloneStrokes(strokes, playerId),
    });
    this.submitted.add(playerId);
    this.advanceIfReady();
  }

  private submitGuess(playerId: string, text: string): void {
    if (this.phase !== "GUESSING") {
      throw new GameError("It is not time to guess");
    }
    if (this.submitted.has(playerId)) {
      throw new GameError("You have already submitted");
    }
    const source = this.currentSourcePage(playerId);
    if (source.kind !== "drawing") {
      throw new GameError("You should be drawing, not guessing");
    }
    const guess = text.trim();
    if (guess.length === 0 || guess.length > 40) {
      throw new GameError("Guess must be 1–40 characters");
    }
    const book = this.bookFor(this.ownerIdFor(playerId));
    book.push({ kind: "guess", authorId: playerId, text: guess });
    this.submitted.add(playerId);
    this.advanceIfReady();
  }

  private forceDrawing(playerId: string): void {
    const source = this.currentSourcePage(playerId);
    if (source.kind !== "prompt" && source.kind !== "guess") {
      return;
    }
    const book = this.bookFor(this.ownerIdFor(playerId));
    book.push({ kind: "drawing", authorId: playerId, strokes: [] });
    this.submitted.add(playerId);
  }

  private forceGuess(playerId: string): void {
    const source = this.currentSourcePage(playerId);
    if (source.kind !== "drawing") {
      return;
    }
    const book = this.bookFor(this.ownerIdFor(playerId));
    book.push({ kind: "guess", authorId: playerId, text: TIMEOUT_GUESS });
    this.submitted.add(playerId);
  }

  private advanceIfReady(): void {
    if (this.submitted.size < this.order.length) {
      return;
    }
    this.round += 1;
    this.submitted = new Set();
    if (this.round >= this.order.length) {
      this.phase = "REVEAL";
      this.endsAt = null;
      return;
    }
    this.phase = this.round % 2 === 0 ? "DRAWING" : "GUESSING";
    this.startPhaseTimer();
  }

  private startPhaseTimer(): void {
    const duration =
      this.phase === "DRAWING" ? DRAWING_ROUND_MS : GUESSING_ROUND_MS;
    this.endsAt = deadlineFromNow(duration);
  }

  private legalActions(playerId: string): TelestrationsActionType[] {
    if (this.isGameOver() || this.submitted.has(playerId)) {
      return [];
    }
    if (this.phase === "DRAWING") {
      return ["submit_drawing"];
    }
    if (this.phase === "GUESSING") {
      return ["submit_guess"];
    }
    return [];
  }

  private ownerIdFor(playerId: string): string {
    const index = this.order.indexOf(playerId);
    if (index < 0) {
      throw new GameError("You are not in this game");
    }
    const n = this.order.length;
    const ownerIndex = (index - this.round + n) % n;
    const ownerId = this.order[ownerIndex];
    if (ownerId === undefined) {
      throw new GameError("Invalid rotation");
    }
    return ownerId;
  }

  private bookFor(ownerId: string): Page[] {
    const book = this.books.get(ownerId);
    if (!book) {
      throw new GameError("Missing book");
    }
    return book;
  }

  private currentSourcePage(playerId: string): Page {
    const book = this.bookFor(this.ownerIdFor(playerId));
    const page = book[book.length - 1];
    if (page === undefined) {
      throw new GameError("Empty book");
    }
    return page;
  }

  private revealedBooks(): TelestrationsBook[] {
    return this.order.map((ownerId) => ({
      ownerId,
      pages: this.bookFor(ownerId).map((page) => this.clonePage(page)),
    }));
  }

  private clonePage(page: Page): TelestrationsRevealedPage {
    if (page.kind === "prompt") {
      return { kind: "prompt", authorId: page.authorId, text: page.text };
    }
    if (page.kind === "guess") {
      return { kind: "guess", authorId: page.authorId, text: page.text };
    }
    return {
      kind: "drawing",
      authorId: page.authorId,
      strokes: cloneStrokes(page.strokes, page.authorId),
    };
  }
}
