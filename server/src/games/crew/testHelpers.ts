import assert from "node:assert/strict";
import type {
  CrewColor,
  CrewCommunicationMarker,
  CrewCompletedTrick,
  CrewRank,
  CrewTaskStatus,
} from "../../protocol/messages.ts";
import type { CrewTaskDef, ResolvedTask } from "./missions.ts";
import type { PhysicalCard } from "./deck.ts";
import { handSizeFor } from "./deck.ts";
import type { CrewGame } from "./CrewGame.ts";

export function task(
  status: CrewTaskStatus,
  def: CrewTaskDef,
  playerId = "p1",
  id = "t1",
): ResolvedTask {
  return {
    id,
    description: "test task",
    def,
    playerId,
    status,
  };
}

export function winTask(
  status: CrewTaskStatus,
  playerId: string,
  color: CrewColor,
  rank: CrewRank,
  id = "t1",
): ResolvedTask {
  return task(
    status,
    { type: "player_wins_card", playerSlot: 0, card: { color, rank } },
    playerId,
    id,
  );
}

export function mustNotWinTask(
  status: CrewTaskStatus,
  playerId: string,
  color: CrewColor,
  rank: CrewRank,
  id = "t1",
): ResolvedTask {
  return task(
    status,
    { type: "player_must_not_win", playerSlot: 0, card: { color, rank } },
    playerId,
    id,
  );
}

export function trick(
  winnerId: string,
  plays: { playerId: string; color: CrewColor; rank: CrewRank }[],
): CrewCompletedTrick {
  return {
    winnerId,
    plays: plays.map((play) => ({
      playerId: play.playerId,
      card: { color: play.color, rank: play.rank },
    })),
  };
}

type CrewGameInternals = {
  tasks: ResolvedTask[];
  phase: string;
  order: string[];
  turnIndex: number;
  hands: Map<string, string[]>;
  cards: Map<string, PhysicalCard>;
  endReason?: string;
  currentTrick: { playerId: string; cardId: string }[];
  completedTricks: CrewCompletedTrick[];
  communications: CrewCommunicationMarker[];
  communicatedPlayers: Set<string>;
};

export function asInternals(game: CrewGame): CrewGameInternals {
  return game as unknown as CrewGameInternals;
}

export function seedHands(
  game: CrewGame,
  handsByPlayer: Record<string, PhysicalCard[]>,
): void {
  const internal = asInternals(game);
  const allCards = Object.values(handsByPlayer).flat();
  internal.cards = new Map(allCards.map((card) => [card.cardId, card]));
  internal.hands = new Map(
    Object.entries(handsByPlayer).map(([playerId, cards]) => [
      playerId,
      cards.map((card) => card.cardId),
    ]),
  );
}

export function card(
  cardId: string,
  color: CrewColor,
  rank: CrewRank,
): PhysicalCard {
  return { cardId, color, rank };
}

export function beginPlaying(
  game: CrewGame,
  playerIds: string[] = ["p1", "p2"],
): void {
  game.setup(playerIds);
  asInternals(game).tasks = [winTask("pending", playerIds[0]!, "blue", 9)];
  game.performAction(playerIds[0]!, { type: "crew_begin_mission" });
  assert.equal(game.getPublicState().phase, "PLAYING");
}

export function playerIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `p${index + 1}`);
}

export function buildOrderedDeck(): PhysicalCard[] {
  const cards: PhysicalCard[] = [];
  let index = 0;
  const suits = ["red", "blue", "green", "yellow"] as const;
  for (const color of suits) {
    for (let rank = 1 as CrewRank; rank <= 9; rank += 1) {
      cards.push({ cardId: `c${index}`, color, rank: rank as CrewRank });
      index += 1;
    }
  }
  for (let rank = 1 as CrewRank; rank <= 4; rank += 1) {
    cards.push({ cardId: `c${index}`, color: "submarine", rank: rank as CrewRank });
    index += 1;
  }
  return cards;
}

export function dealFromDeck(
  game: CrewGame,
  playerIds: string[],
  deck: PhysicalCard[],
): void {
  const internal = asInternals(game);
  internal.cards = new Map(deck.map((entry) => [entry.cardId, entry]));
  internal.order = [...playerIds];
  internal.hands = new Map();
  let deckIndex = 0;
  const handSize = handSizeFor(playerIds.length);
  for (const playerId of playerIds) {
    const hand: string[] = [];
    for (let i = 0; i < handSize; i += 1) {
      const next = deck[deckIndex];
      deckIndex += 1;
      if (!next) {
        throw new Error("deck exhausted");
      }
      hand.push(next.cardId);
    }
    internal.hands.set(playerId, hand);
  }
}

export function allHandAndTrickCardIds(game: CrewGame): string[] {
  const internal = asInternals(game);
  return [...internal.hands.values()].flat().concat(
    internal.currentTrick.map((play) => play.cardId),
  );
}

export function assertRejectedAction(
  game: CrewGame,
  action: () => void,
): void {
  const internal = asInternals(game);
  const before = {
    phase: internal.phase,
    turnIndex: internal.turnIndex,
    tasks: structuredClone(internal.tasks),
    hands: structuredClone([...internal.hands.entries()]),
    trick: structuredClone(internal.currentTrick),
    completed: structuredClone(internal.completedTricks),
    communications: structuredClone(internal.communications),
    communicated: [...internal.communicatedPlayers],
  };
  assert.throws(action);
  assert.equal(internal.phase, before.phase);
  assert.equal(internal.turnIndex, before.turnIndex);
  assert.deepEqual(internal.tasks, before.tasks);
  assert.deepEqual([...internal.hands.entries()], before.hands);
  assert.deepEqual(internal.currentTrick, before.trick);
  assert.deepEqual(internal.completedTricks, before.completed);
  assert.deepEqual(internal.communications, before.communications);
  assert.deepEqual([...internal.communicatedPlayers], before.communicated);
}

