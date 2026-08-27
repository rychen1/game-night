import type { GangChipColor, GangHandCategory, GangRank } from "../../protocol/messages.ts";
import type { GangChallengeId, GangSpecialistId } from "./modifiers.ts";

export const CHIP_STREETS: GangChipColor[] = ["white", "yellow", "orange", "red"];

export function isFaceCardRank(rank: number): boolean {
  return rank >= 11 && rank <= 13;
}

export function flopHasFaceCard(
  communityCards: { rank: number }[],
): boolean {
  return communityCards.some((card) => isFaceCardRank(card.rank));
}

export function shouldLockStar(
  challengeIds: Set<GangChallengeId>,
  chipColor: GangChipColor,
  star: number,
  playerCount: number,
): boolean {
  if (chipColor === "red") {
    return false;
  }
  if (challengeIds.has("noiseSensors") && star === 1) {
    return true;
  }
  if (challengeIds.has("ventilationShaft") && star === playerCount) {
    return true;
  }
  return false;
}

export function categoryLabel(category: GangHandCategory): string {
  switch (category) {
    case "high_card":
      return "High card";
    case "pair":
      return "Pair";
    case "two_pair":
      return "Two pair";
    case "three_kind":
      return "Three of a kind";
    case "straight":
      return "Straight";
    case "flush":
      return "Flush";
    case "full_house":
      return "Full house";
    case "four_kind":
      return "Four of a kind";
    case "straight_flush":
      return "Straight flush";
    case "royal_flush":
      return "Royal flush";
  }
}

export function rankDisplay(rank: GangRank): string {
  switch (rank) {
    case 11:
      return "Jack";
    case 12:
      return "Queen";
    case 13:
      return "King";
    case 14:
      return "Ace";
    default:
      return String(rank);
  }
}

export function specialistNeedsAssignee(id: GangSpecialistId): boolean {
  return (
    id === "informant" ||
    id === "getawayDriver" ||
    id === "mastermind" ||
    id === "hacker" ||
    id === "jack" ||
    id === "muscle"
  );
}

export function specialistNeedsAllPlayers(id: GangSpecialistId): boolean {
  return id === "investor" || id === "mathWhiz" || id === "coordinator";
}

export function specialistIsAutomatic(id: GangSpecialistId): boolean {
  return id === "conwoman";
}
