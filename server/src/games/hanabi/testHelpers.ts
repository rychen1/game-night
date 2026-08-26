import type {
  HanabiColor,
  HanabiKnowledge,
  HanabiPublicCard,
  HanabiRank,
} from "../../protocol/messages.ts";
import { emptyStacks, type PhysicalCard } from "./deck.ts";
import type { HanabiGame } from "./HanabiGame.ts";

export function card(
  cardId: string,
  color: HanabiColor,
  rank: HanabiRank,
): PhysicalCard {
  return { cardId, color, rank };
}

type HanabiGameInternals = {
  phase: string;
  order: string[];
  turnIndex: number;
  cards: Map<string, PhysicalCard>;
  deck: string[];
  hands: Map<string, string[]>;
  knowledge: Map<string, HanabiKnowledge>;
  stacks: Record<HanabiColor, number>;
  discard: HanabiPublicCard[];
  clueTokens: number;
  fuseTokens: number;
  finalTurnsLeft: number | null;
  endReason?: string;
  log: unknown[];
};

export function asInternals(game: HanabiGame): HanabiGameInternals {
  return game as unknown as HanabiGameInternals;
}

export function setupWithOrder(
  game: HanabiGame,
  playerIds: string[],
): void {
  game.setup(playerIds);
  const internal = asInternals(game);
  internal.order = [...playerIds];
  internal.turnIndex = 0;
}

export function emptyKnowledge(): HanabiKnowledge {
  return { notColors: [], notRanks: [] };
}

/** Fixed-order game with one deck card left; current player can empty via play or discard. */
export function arrangeFinalDraw(
  game: HanabiGame,
  playerIds: string[],
  options: { via: "play" | "discard"; emptierId?: string },
): { emptierId: string; emptierCardId: string } {
  const emptierId = options.emptierId ?? playerIds[0]!;
  setupWithOrder(game, playerIds);
  const internal = asInternals(game);
  internal.turnIndex = playerIds.indexOf(emptierId);

  const lastDeckCard = card("deck-last", "white", 1);
  const emptierCard = card("emptier-hand", "blue", 3);

  internal.cards = new Map([
    [lastDeckCard.cardId, lastDeckCard],
    [emptierCard.cardId, emptierCard],
  ]);
  internal.hands = new Map([[emptierId, [emptierCard.cardId]]]);
  internal.knowledge = new Map([
    [emptierCard.cardId, emptyKnowledge()],
  ]);

  for (const id of playerIds) {
    if (id === emptierId) {
      continue;
    }
    const hold = card(`hold-${id}`, "red", 1);
    internal.cards.set(hold.cardId, hold);
    internal.hands.set(id, [hold.cardId]);
    internal.knowledge.set(hold.cardId, emptyKnowledge());
  }

  internal.deck = [lastDeckCard.cardId];
  internal.stacks = emptyStacks();
  internal.discard = [];
  internal.clueTokens = options.via === "discard" ? 7 : 8;
  internal.fuseTokens = 3;
  internal.finalTurnsLeft = null;
  internal.phase = "PLAYING";
  internal.log = [];

  return { emptierId, emptierCardId: emptierCard.cardId };
}

export function emptyDeckViaAction(
  game: HanabiGame,
  emptierId: string,
  emptierCardId: string,
  via: "play" | "discard",
): void {
  if (via === "discard") {
    game.performAction(emptierId, {
      type: "discard_card",
      cardId: emptierCardId,
    });
    return;
  }
  game.performAction(emptierId, { type: "play_card", cardId: emptierCardId });
}

export function passTurnWithClue(
  game: HanabiGame,
  actorId: string,
  playerIds: string[],
): void {
  const targetId = playerIds.find((id) => id !== actorId);
  if (!targetId) {
    throw new Error("expected a clue target");
  }
  const targetHand = asInternals(game).hands.get(targetId) ?? [];
  const firstCardId = targetHand[0];
  if (!firstCardId) {
    throw new Error("expected target to hold a card");
  }
  const targetCard = asInternals(game).cards.get(firstCardId);
  if (!targetCard) {
    throw new Error("expected target card");
  }
  game.performAction(actorId, {
    type: "give_clue",
    targetPlayerId: targetId,
    clue: { type: "color", value: targetCard.color },
  });
}
