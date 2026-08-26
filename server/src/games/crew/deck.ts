import type { CrewColor, CrewRank } from "../../protocol/messages.ts";

export type PhysicalCard = {
  cardId: string;
  color: CrewColor;
  rank: CrewRank;
};

export const CREW_SUITS: Exclude<CrewColor, "submarine">[] = [
  "red",
  "blue",
  "green",
  "yellow",
];

/** One card of each rank 1–9 per suit (36) + 4 submarine trump = 40. */
const SUIT_RANKS: CrewRank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const SUBMARINE_RANKS: CrewRank[] = [1, 2, 3, 4];

/** Official Deep Sea deal sizes per seat (2p unchanged — no Tonoja variant). */
export function handSizesFor(playerCount: number): readonly number[] {
  if (playerCount === 2) {
    return [10, 10];
  }
  if (playerCount === 3) {
    return [14, 13, 13];
  }
  if (playerCount === 4) {
    return [10, 10, 10, 10];
  }
  if (playerCount === 5) {
    return [8, 8, 8, 8, 8];
  }
  throw new Error(`Unsupported player count: ${playerCount}`);
}

export function totalDealtCards(playerCount: number): number {
  return handSizesFor(playerCount).reduce((sum, size) => sum + size, 0);
}

export function buildShuffledDeck(): PhysicalCard[] {
  const cards: PhysicalCard[] = [];
  let index = 0;
  for (const color of CREW_SUITS) {
    for (const rank of SUIT_RANKS) {
      cards.push({ cardId: `c${index}`, color, rank });
      index += 1;
    }
  }
  for (const rank of SUBMARINE_RANKS) {
    cards.push({ cardId: `c${index}`, color: "submarine", rank });
    index += 1;
  }
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = cards[i];
    const b = cards[j];
    if (a === undefined || b === undefined) {
      continue;
    }
    cards[i] = b;
    cards[j] = a;
  }
  return cards;
}

export function publicCard(card: PhysicalCard): {
  color: CrewColor;
  rank: CrewRank;
} {
  return { color: card.color, rank: card.rank };
}

/** Higher value wins among cards that are eligible for the trick. */
export function trickWinnerIndex(
  plays: { card: PhysicalCard }[],
): number {
  if (plays.length === 0) {
    return 0;
  }
  const led = plays[0]?.card.color;
  if (!led) {
    return 0;
  }
  let best = 0;
  for (let i = 1; i < plays.length; i += 1) {
    const candidate = plays[i]?.card;
    const current = plays[best]?.card;
    if (!candidate || !current) {
      continue;
    }
    if (beats(candidate, current, led)) {
      best = i;
    }
  }
  return best;
}

function beats(
  candidate: PhysicalCard,
  current: PhysicalCard,
  ledColor: CrewColor,
): boolean {
  const candidateTrump = candidate.color === "submarine";
  const currentTrump = current.color === "submarine";
  if (candidateTrump && !currentTrump) {
    return true;
  }
  if (!candidateTrump && currentTrump) {
    return false;
  }
  if (candidateTrump && currentTrump) {
    return candidate.rank > current.rank;
  }
  const candidateFollows = candidate.color === ledColor;
  const currentFollows = current.color === ledColor;
  if (candidateFollows && !currentFollows) {
    return true;
  }
  if (!candidateFollows && currentFollows) {
    return false;
  }
  if (candidateFollows && currentFollows) {
    return candidate.rank > current.rank;
  }
  return false;
}
