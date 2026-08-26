import type { HanabiColor, HanabiRank } from "../../protocol/messages.ts";

export type PhysicalCard = {
  cardId: string;
  color: HanabiColor;
  rank: HanabiRank;
};

export const HANABI_COLORS: HanabiColor[] = [
  "red",
  "yellow",
  "green",
  "blue",
  "white",
];

const RANKS_PER_COLOR: HanabiRank[] = [1, 1, 1, 2, 2, 3, 3, 4, 4, 5];

export function emptyStacks(): Record<HanabiColor, number> {
  return { red: 0, yellow: 0, green: 0, blue: 0, white: 0 };
}

export function handSizeFor(playerCount: number): number {
  return playerCount <= 3 ? 5 : 4;
}

export function buildShuffledDeck(): PhysicalCard[] {
  const cards: PhysicalCard[] = [];
  let n = 0;
  for (const color of HANABI_COLORS) {
    for (const rank of RANKS_PER_COLOR) {
      cards.push({ cardId: `h${n}`, color, rank });
      n += 1;
    }
  }
  return shuffle(cards);
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = next[i];
    const b = next[j];
    if (a === undefined || b === undefined) {
      continue;
    }
    next[i] = b;
    next[j] = a;
  }
  return next;
}
