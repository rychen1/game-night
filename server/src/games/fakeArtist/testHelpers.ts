import assert from "node:assert/strict";
import type { StrokePoint } from "../../protocol/messages.ts";
import type { FakeArtistGame } from "./FakeArtistGame.ts";

const ROUNDS = 2;

type FakeArtistGameInternals = {
  phase: string;
  players: Set<string>;
  turnOrder: string[];
  turnQueue: string[];
  turnIndex: number;
  fakeArtistId: string;
  word: string;
  category: string;
  strokes: unknown[];
  votes: Map<string, string>;
  winner: string | null;
  endsAt: number | null;
};

export function asInternals(game: FakeArtistGame): FakeArtistGameInternals {
  return game as unknown as FakeArtistGameInternals;
}

export function playerIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `p${index + 1}`);
}

export function assertNoSecretLeakDuringPlay(
  game: FakeArtistGame,
  fakeArtistId: string,
  artistId: string,
): void {
  const pub = game.getPublicState() as Record<string, unknown>;
  assert.equal(pub.word, undefined);
  assert.equal(pub.fakeArtistId, undefined);
  assert.equal(pub.votes, undefined);
  assert.equal(game.getPrivateState(fakeArtistId).word, undefined);
  assert.ok(game.getPrivateState(artistId).word);
}

export function setupFixedOrder(
  game: FakeArtistGame,
  playerIds: string[],
  fakeArtistId?: string,
): void {
  game.setup(playerIds);
  const internal = asInternals(game);
  internal.turnOrder = [...playerIds];
  internal.turnQueue = [];
  for (let round = 0; round < ROUNDS; round += 1) {
    internal.turnQueue.push(...playerIds);
  }
  internal.turnIndex = 0;
  internal.fakeArtistId = fakeArtistId ?? playerIds[1] ?? playerIds[0]!;
  internal.word = "Pizza";
  internal.category = "Food";
}

export function setWord(game: FakeArtistGame, word: string): void {
  asInternals(game).word = word;
}

export function setFakeArtist(game: FakeArtistGame, playerId: string): void {
  asInternals(game).fakeArtistId = playerId;
}

export function setDeadline(game: FakeArtistGame, endsAt: number | null): void {
  asInternals(game).endsAt = endsAt;
}

export function stroke(points: StrokePoint[] = [{ x: 0.1, y: 0.2 }]): StrokePoint[] {
  return points;
}

export function completeDrawing(game: FakeArtistGame, playerIds: string[]): void {
  const turns = playerIds.length * ROUNDS;
  for (let i = 0; i < turns; i += 1) {
    const current = game.getPublicState().currentPlayerId;
    if (!current) {
      throw new Error("expected a drawing turn");
    }
    game.performAction(current, { type: "submit_stroke", points: stroke() });
  }
}

export function castVote(
  game: FakeArtistGame,
  voterId: string,
  targetPlayerId: string,
): void {
  game.performAction(voterId, { type: "vote", targetPlayerId });
}
