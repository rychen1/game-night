import type { GangCard, GangRank, GangSuit } from "../../network/messages.ts";

export function rankLabel(rank: GangRank): string {
  switch (rank) {
    case 11:
      return "J";
    case 12:
      return "Q";
    case 13:
      return "K";
    case 14:
      return "A";
    default:
      return String(rank);
  }
}

export function suitSymbol(suit: GangSuit): string {
  switch (suit) {
    case "clubs":
      return "♣";
    case "diamonds":
      return "♦";
    case "hearts":
      return "♥";
    case "spades":
      return "♠";
  }
}

export function isRedSuit(suit: GangSuit): boolean {
  return suit === "hearts" || suit === "diamonds";
}

export function cardLabel(card: GangCard): string {
  return `${rankLabel(card.rank)}${suitSymbol(card.suit)}`;
}

export const PHASE_LABEL: Record<string, string> = {
  PREFLOP: "Pre-flop",
  FLOP: "Flop",
  TURN: "Turn",
  RIVER: "River",
  SHOWDOWN: "Showdown",
  RESULTS: "Results",
  ABORTED: "Aborted",
};

export const CHIP_COLOR_LABEL: Record<string, string> = {
  white: "Pre-flop",
  yellow: "Flop",
  orange: "Turn",
  red: "River",
};
