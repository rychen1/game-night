import type { GangCard, GangChipColor, GangPhase } from "../../protocol/messages.ts";
import type { GangActiveModifier } from "./modifiers.ts";
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
  heistNumber: number;
  vaultsOpened: number;
  alarms: number;
  activeModifiers: GangActiveModifier[];
  challengeDrawIndex: number;
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

export function setActiveModifiers(
  game: TheGangGame,
  modifiers: GangActiveModifier[],
): void {
  asInternals(game).activeModifiers = modifiers.map((modifier) => ({ ...modifier }));
}

export function setRotatingSpecialist(
  game: TheGangGame,
  specialistId: GangActiveModifier["id"],
): void {
  asInternals(game).activeModifiers = [
    { kind: "specialist", id: specialistId },
  ];
}

export function setChallengeDrawIndex(game: TheGangGame, index: number): void {
  asInternals(game).challengeDrawIndex = index;
}

export function proceedStreet(game: TheGangGame, playerId: string): void {
  game.performAction(playerId, { type: "gang_proceed_street" });
}

export function claimRound(
  game: TheGangGame,
  playerIds: string[],
  stars: number[],
): void {
  playerIds.forEach((playerId, index) => {
    game.performAction(playerId, { type: "gang_claim_strength", star: stars[index]! });
  });
  proceedStreet(game, playerIds[0]!);
}

export function card(
  rank: GangCard["rank"],
  suit: GangCard["suit"],
): GangCard {
  return { rank, suit };
}
