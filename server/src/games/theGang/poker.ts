import type { GangCard, GangRank } from "./cards.ts";
import { isJackSpecialist } from "./cards.ts";

export type HandCategory =
  | "high_card"
  | "pair"
  | "two_pair"
  | "three_kind"
  | "straight"
  | "flush"
  | "full_house"
  | "four_kind"
  | "straight_flush"
  | "royal_flush";

const CATEGORY_ORDER: Record<HandCategory, number> = {
  high_card: 0,
  pair: 1,
  two_pair: 2,
  three_kind: 3,
  straight: 4,
  flush: 5,
  full_house: 6,
  four_kind: 7,
  straight_flush: 8,
  royal_flush: 9,
};

export type EvaluatedHand = {
  category: HandCategory;
  /** Tiebreakers, highest significance first. */
  ranks: number[];
};

export type GangHandView = {
  category: HandCategory;
  label: string;
  cards: GangCard[];
};

export function compareEvaluatedHands(a: EvaluatedHand, b: EvaluatedHand): number {
  const categoryDiff = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
  if (categoryDiff !== 0) {
    return categoryDiff;
  }
  const len = Math.max(a.ranks.length, b.ranks.length);
  for (let i = 0; i < len; i += 1) {
    const diff = (a.ranks[i] ?? 0) - (b.ranks[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

export function compareForShowdown(
  a: EvaluatedHand,
  b: EvaluatedHand,
  playerA: string,
  playerB: string,
  musclePlayerId: string | null,
): number {
  const base = compareEvaluatedHands(a, b);
  if (base !== 0) {
    return base;
  }
  if (musclePlayerId === playerA) {
    return 1;
  }
  if (musclePlayerId === playerB) {
    return -1;
  }
  return 0;
}

function combinations<T>(items: T[], choose: number): T[][] {
  if (choose === 0) {
    return [[]];
  }
  if (items.length < choose) {
    return [];
  }
  const [first, ...rest] = items;
  const withFirst = combinations(rest, choose - 1).map((combo) => [first!, ...combo]);
  const withoutFirst = combinations(rest, choose);
  return [...withFirst, ...withoutFirst];
}

export function evaluateBest(cards: GangCard[]): EvaluatedHand {
  if (cards.length < 5) {
    throw new Error("Need at least 5 cards");
  }
  let best: EvaluatedHand | null = null;
  for (const combo of combinations(cards, 5)) {
    const hand = evaluateFive(combo);
    if (!best || compareEvaluatedHands(hand, best) > 0) {
      best = hand;
    }
  }
  if (!best) {
    throw new Error("Failed to evaluate hand");
  }
  return best;
}

export function evaluateFive(cards: GangCard[]): EvaluatedHand {
  const ranks = cards.map((card) => card.rank).sort((a, b) => b - a);
  const suitedCards = cards.filter((card) => !isJackSpecialist(card));
  const isFlush =
    suitedCards.length === 5 &&
    suitedCards.every((card) => card.suit === suitedCards[0]!.suit);
  const straightHigh = straightHighRank(ranks);
  const rankCounts = countRanks(ranks);

  if (isFlush && straightHigh !== null) {
    const category = isRoyalFlush(ranks) ? "royal_flush" : "straight_flush";
    return {
      category,
      ranks: [straightHigh],
    };
  }

  const quads = rankByCount(rankCounts, 4);
  if (quads.length > 0) {
    const kicker = highestRankExcluding(ranks, [quads[0]!]);
    return { category: "four_kind", ranks: [quads[0]!, kicker] };
  }

  const trips = rankByCount(rankCounts, 3);
  const pairs = rankByCount(rankCounts, 2);
  if (trips.length > 0 && pairs.length > 0) {
    return {
      category: "full_house",
      ranks: [trips[0]!, pairs[0]!],
    };
  }

  if (isFlush) {
    return { category: "flush", ranks: [...ranks] };
  }

  if (straightHigh !== null) {
    return { category: "straight", ranks: [straightHigh] };
  }

  if (trips.length > 0) {
    const kickers = ranks.filter((rank) => rank !== trips[0]).slice(0, 2);
    return { category: "three_kind", ranks: [trips[0]!, ...kickers] };
  }

  if (pairs.length >= 2) {
    const [highPair, lowPair] = pairs.slice(0, 2);
    const kicker = highestRankExcluding(ranks, [highPair!, lowPair!]);
    return {
      category: "two_pair",
      ranks: [highPair!, lowPair!, kicker],
    };
  }

  if (pairs.length === 1) {
    const pair = pairs[0]!;
    const kickers = ranks.filter((rank) => rank !== pair).slice(0, 3);
    return { category: "pair", ranks: [pair, ...kickers] };
  }

  return { category: "high_card", ranks: [...ranks] };
}

export function bestFiveCards(hole: GangCard[], community: GangCard[]): GangCard[] {
  const all = [...hole, ...community];
  let bestHand: EvaluatedHand | null = null;
  let bestCards: GangCard[] = [];
  for (const combo of combinations(all, 5)) {
    const evaluated = evaluateFive(combo);
    if (!bestHand || compareEvaluatedHands(evaluated, bestHand) > 0) {
      bestHand = evaluated;
      bestCards = combo;
    }
  }
  return bestCards;
}

export function handLabel(hand: EvaluatedHand): string {
  switch (hand.category) {
    case "high_card":
      return `High card ${rankName(hand.ranks[0] as GangRank)}`;
    case "pair":
      return `Pair of ${rankNamePlural(hand.ranks[0] as GangRank)}`;
    case "two_pair":
      return `Two pair ${rankNamePlural(hand.ranks[0] as GangRank)} and ${rankNamePlural(hand.ranks[1] as GangRank)}`;
    case "three_kind":
      return `Three of a kind ${rankNamePlural(hand.ranks[0] as GangRank)}`;
    case "straight":
      return `Straight to ${rankName(hand.ranks[0] as GangRank)}`;
    case "flush":
      return `Flush ${rankName(hand.ranks[0] as GangRank)} high`;
    case "full_house":
      return `Full house ${rankNamePlural(hand.ranks[0] as GangRank)} over ${rankNamePlural(hand.ranks[1] as GangRank)}`;
    case "four_kind":
      return `Four of a kind ${rankNamePlural(hand.ranks[0] as GangRank)}`;
    case "straight_flush":
      return `Straight flush to ${rankName(hand.ranks[0] as GangRank)}`;
    case "royal_flush":
      return "Royal flush";
  }
}

function isRoyalFlush(ranks: number[]): boolean {
  const needed = new Set([10, 11, 12, 13, 14]);
  for (const rank of ranks) {
    needed.delete(rank);
  }
  return needed.size === 0;
}

function countRanks(ranks: number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const rank of ranks) {
    counts.set(rank, (counts.get(rank) ?? 0) + 1);
  }
  return counts;
}

function rankByCount(counts: Map<number, number>, target: number): number[] {
  return [...counts.entries()]
    .filter(([, count]) => count === target)
    .map(([rank]) => rank)
    .sort((a, b) => b - a);
}

function highestRankExcluding(ranks: number[], excluded: number[]): number {
  for (const rank of ranks) {
    if (!excluded.includes(rank)) {
      return rank;
    }
  }
  return 0;
}

function straightHighRank(ranks: number[]): number | null {
  const unique = [...new Set(ranks)];
  if (unique.includes(14)) {
    unique.push(1);
  }
  unique.sort((a, b) => a - b);
  let bestHigh: number | null = null;
  for (let start = 0; start <= unique.length - 5; start += 1) {
    let consecutive = true;
    for (let offset = 1; offset < 5; offset += 1) {
      if (unique[start + offset] !== unique[start]! + offset) {
        consecutive = false;
        break;
      }
    }
    if (consecutive) {
      const high = unique[start + 4]!;
      bestHigh = high === 1 ? 5 : high;
    }
  }
  return bestHigh;
}

function rankName(rank: GangRank): string {
  switch (rank) {
    case 11:
      return "jack";
    case 12:
      return "queen";
    case 13:
      return "king";
    case 14:
      return "ace";
    default:
      return String(rank);
  }
}

function rankNamePlural(rank: GangRank): string {
  switch (rank) {
    case 11:
      return "jacks";
    case 12:
      return "queens";
    case 13:
      return "kings";
    case 14:
      return "aces";
    default:
      return `${rank}s`;
  }
}

export function toHandView(hole: GangCard[], community: GangCard[]): GangHandView {
  const cards = bestFiveCards(hole, community);
  const evaluated = evaluateFive(cards);
  return {
    category: evaluated.category,
    label: handLabel(evaluated),
    cards,
  };
}

export function handStrength(hole: GangCard[], community: GangCard[]): EvaluatedHand {
  return evaluateBest([...hole, ...community]);
}

export function pocketContainsRank(hole: GangCard[], rank: GangRank): boolean {
  return hole.some((card) => card.rank === rank);
}

export function countFaceCards(hole: GangCard[]): number {
  return hole.filter((card) => card.rank >= 11 && card.rank <= 13).length;
}

export function mathWhizSum(hole: GangCard[]): number {
  return hole.reduce((total, card) => {
    if (card.rank >= 11 && card.rank <= 13) {
      return total + 10;
    }
    if (card.rank === 14) {
      return total + 11;
    }
    return total + card.rank;
  }, 0);
}

export function countRankInHole(hole: GangCard[], rank: GangRank): number {
  return hole.filter((card) => card.rank === rank).length;
}

/** @deprecated Use evaluateBest / handStrength with variable hole counts. */
export function evaluateSeven(cards: GangCard[]): EvaluatedHand {
  return evaluateBest(cards);
}
