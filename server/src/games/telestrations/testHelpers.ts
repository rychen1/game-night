import assert from "node:assert/strict";
import type { Stroke, StrokePoint } from "../../protocol/messages.ts";
import type { TelestrationsGame } from "./TelestrationsGame.ts";

type Page =
  | { kind: "prompt"; authorId: string; text: string }
  | { kind: "drawing"; authorId: string; strokes: Stroke[] }
  | { kind: "guess"; authorId: string; text: string };

type TelestrationsGameInternals = {
  phase: string;
  order: string[];
  round: number;
  books: Map<string, Page[]>;
  submitted: Set<string>;
  endsAt: number | null;
};

export function asInternals(game: TelestrationsGame): TelestrationsGameInternals {
  return game as unknown as TelestrationsGameInternals;
}

export function playerIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `p${index + 1}`);
}

export function ownerIdFor(order: string[], playerId: string, round: number): string {
  const index = order.indexOf(playerId);
  const n = order.length;
  return order[(index - round + n) % n]!;
}

export function contributionRoundCount(playerCount: number): number {
  return playerCount % 2 === 0 ? playerCount : playerCount + 1;
}

export function expectedBookPageCount(playerCount: number): number {
  return contributionRoundCount(playerCount) + 1;
}

export function expectedPageKind(pageIndex: number): "prompt" | "drawing" | "guess" {
  if (pageIndex === 0) {
    return "prompt";
  }
  return pageIndex % 2 === 1 ? "drawing" : "guess";
}

export function bookLengths(game: TelestrationsGame): Map<string, number> {
  const lengths = new Map<string, number>();
  for (const [ownerId, pages] of asInternals(game).books) {
    lengths.set(ownerId, pages.length);
  }
  return lengths;
}

export function cloneBookLengths(lengths: Map<string, number>): Map<string, number> {
  return new Map(lengths);
}

export function setupFixedOrder(
  game: TelestrationsGame,
  ids: string[],
  prompts?: string[],
): void {
  game.setup(ids);
  const internal = asInternals(game);
  internal.order = [...ids];
  if (prompts) {
    for (const [index, id] of ids.entries()) {
      internal.books.set(id, [
        { kind: "prompt", authorId: id, text: prompts[index] ?? `Prompt-${index + 1}` },
      ]);
    }
  } else {
    for (const [index, id] of ids.entries()) {
      internal.books.set(id, [
        { kind: "prompt", authorId: id, text: `Prompt-${index + 1}` },
      ]);
    }
  }
}

export function setDeadline(game: TelestrationsGame, endsAt: number | null): void {
  asInternals(game).endsAt = endsAt;
}

export function stroke(points: StrokePoint[] = [{ x: 0.1, y: 0.2 }]): Stroke[] {
  return [{ playerId: "unused", points }];
}

export function taggedDrawing(playerId: string): Stroke[] {
  return [{ playerId, points: [{ x: 0.1, y: 0.2 }] }];
}

export function submitDrawing(
  game: TelestrationsGame,
  playerId: string,
  strokes: Stroke[] = stroke(),
): void {
  game.performAction(playerId, { type: "submit_drawing", strokes });
}

export function submitGuess(game: TelestrationsGame, playerId: string, text: string): void {
  game.performAction(playerId, { type: "submit_guess", text });
}

export function submitTaggedDrawing(game: TelestrationsGame, playerId: string): void {
  submitDrawing(game, playerId, taggedDrawing(playerId));
}

export function submitTaggedGuess(game: TelestrationsGame, playerId: string): void {
  submitGuess(game, playerId, `GUESS:${playerId}`);
}

export function submitAllInPhase(game: TelestrationsGame, ids: string[]): void {
  const phase = game.getPublicState().phase;
  for (const id of ids) {
    if (phase === "DRAWING") {
      submitTaggedDrawing(game, id);
    } else if (phase === "GUESSING") {
      submitTaggedGuess(game, id);
    }
  }
}

export function completeGame(game: TelestrationsGame, ids: string[]): void {
  const totalRounds = contributionRoundCount(ids.length);
  for (let round = 0; round < totalRounds; round += 1) {
    submitAllInPhase(game, ids);
  }
}

export function timeoutRound(game: TelestrationsGame): void {
  setDeadline(game, Date.now() - 1);
  game.onTimer();
}

export function completeGameByTimeout(game: TelestrationsGame, ids: string[]): void {
  for (let round = 0; round < contributionRoundCount(ids.length); round += 1) {
    timeoutRound(game);
  }
}

export function assertBookIntegrity(
  game: TelestrationsGame,
  ids: string[],
  round: number,
): void {
  const internal = asInternals(game);
  assert.equal(internal.books.size, ids.length);
  for (const id of ids) {
    const pages = internal.books.get(id);
    assert.ok(pages);
    assert.equal(pages.length, round + 1);
    assert.equal(pages[0]?.kind, "prompt");
    assert.equal(pages[0]?.authorId, id);
    for (let pageIndex = 1; pageIndex < pages.length; pageIndex += 1) {
      assert.equal(pages[pageIndex]?.kind, expectedPageKind(pageIndex));
    }
  }
}
