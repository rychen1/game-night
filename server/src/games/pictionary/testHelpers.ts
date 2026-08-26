import type { StrokePoint } from "../../protocol/messages.ts";
import type { PictionaryGame } from "./PictionaryGame.ts";

type PictionaryGameInternals = {
  phase: string;
  active: Set<string>;
  remainingToDraw: string[];
  drawn: Set<string>;
  word: string;
  strokes: unknown[];
  guesses: unknown[];
  endsAt: number | null;
  history: unknown[];
  lastRound: unknown;
};

export function asInternals(game: PictionaryGame): PictionaryGameInternals {
  return game as unknown as PictionaryGameInternals;
}

export function setupFixedQueue(
  game: PictionaryGame,
  playerIds: string[],
): void {
  game.setup(playerIds);
  asInternals(game).remainingToDraw = [...playerIds];
  asInternals(game).drawn = new Set();
}

export function setWord(game: PictionaryGame, word: string): void {
  asInternals(game).word = word;
}

export function setDeadline(game: PictionaryGame, endsAt: number | null): void {
  asInternals(game).endsAt = endsAt;
}

export function stroke(points: StrokePoint[] = [{ x: 0.1, y: 0.2 }]) {
  return points;
}
