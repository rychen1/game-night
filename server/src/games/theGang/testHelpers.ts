import type { GangCard, GangChipColor, GangPhase } from "../../protocol/messages.ts";
import { TheGangGame } from "./TheGangGame.ts";

type TheGangGameInternals = {
  phase: GangPhase;
  active: Set<string>;
  playerOrder: string[];
  deck: GangCard[];
  holeCards: Record<string, GangCard[]>;
  communityCards: GangCard[];
  chipColor: GangChipColor;
  chipHeld: Map<string, number>;
  chipCenter: number[];
  heistNumber: number;
  vaultsOpened: number;
  alarms: number;
};

export function asInternals(game: TheGangGame): TheGangGameInternals {
  return game as unknown as TheGangGameInternals;
}

export function setupFixedOrder(game: TheGangGame, playerIds: string[]): void {
  game.setup(playerIds);
  asInternals(game).playerOrder = [...playerIds];
}

export function setHoleCards(
  game: TheGangGame,
  playerId: string,
  cards: GangCard[],
): void {
  asInternals(game).holeCards[playerId] = cards.map((card) => ({ ...card }));
}

export function setCommunity(game: TheGangGame, cards: GangCard[]): void {
  asInternals(game).communityCards = cards.map((card) => ({ ...card }));
}

export function assignChips(
  game: TheGangGame,
  held: Record<string, number>,
): void {
  const internal = asInternals(game);
  internal.chipHeld = new Map(Object.entries(held));
  const stars = Array.from({ length: internal.playerOrder.length }, (_, i) => i + 1);
  internal.chipCenter = stars.filter(
    (star) => !Object.values(held).includes(star),
  );
}

export function setPhase(game: TheGangGame, phase: GangPhase, chipColor: GangChipColor): void {
  const internal = asInternals(game);
  internal.phase = phase;
  internal.chipColor = chipColor;
}

export function completeAllPhasesToRiver(
  game: TheGangGame,
  chipPlan: Record<GangChipColor, Record<string, number>>,
): void {
  const colors: GangChipColor[] = ["white", "yellow", "orange", "red"];
  for (const color of colors) {
    assignChips(game, chipPlan[color]);
    game.advancePhaseForTests();
  }
}

export function card(
  rank: GangCard["rank"],
  suit: GangCard["suit"],
): GangCard {
  return { rank, suit };
}
