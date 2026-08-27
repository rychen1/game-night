export type GangSuit = "clubs" | "diamonds" | "hearts" | "spades";

export type GangRank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export type GangCard = {
  suit: GangSuit;
  rank: GangRank;
};

const SUITS: GangSuit[] = ["clubs", "diamonds", "hearts", "spades"];
const RANKS: GangRank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

export function createDeck(): GangCard[] {
  const deck: GangCard[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

export function shuffleDeck(deck: GangCard[]): GangCard[] {
  const next = [...deck];
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

export function cardKey(card: GangCard): string {
  return `${card.rank}-${card.suit}`;
}

export function cloneCard(card: GangCard): GangCard {
  return { suit: card.suit, rank: card.rank };
}

export function cloneCards(cards: GangCard[]): GangCard[] {
  return cards.map(cloneCard);
}

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

export function cardLabel(card: GangCard): string {
  return `${rankLabel(card.rank)}${suitSymbol(card.suit)}`;
}
