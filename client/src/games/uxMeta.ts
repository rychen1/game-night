import type { GameId } from "../network/messages.ts";
import {
  GAME_CATALOG,
  HOME_GAME_GENRE,
  type GameCatalogEntry,
  type GameGenre,
} from "./catalog.ts";

/**
 * Conceptual Game Night metadata for UX / catalog documentation.
 * Not a protocol field — derived from existing registry/catalog facts.
 */
export type GameNightMeta = GameCatalogEntry & {
  genre: GameGenre;
  genreLabel: string;
  usesTimer: boolean;
  hasGameplayHistory: boolean;
  hasEndReview: boolean;
  hasConventionalScoring: boolean;
};

const UX_FLAGS: Record<
  GameId,
  Pick<
    GameNightMeta,
    | "usesTimer"
    | "hasGameplayHistory"
    | "hasEndReview"
    | "hasConventionalScoring"
  >
> = {
  pictionary: {
    usesTimer: true,
    hasGameplayHistory: true,
    hasEndReview: true,
    hasConventionalScoring: false,
  },
  telestrations: {
    usesTimer: true,
    hasGameplayHistory: true,
    hasEndReview: true,
    hasConventionalScoring: false,
  },
  fakeArtist: {
    usesTimer: true,
    hasGameplayHistory: true,
    hasEndReview: true,
    hasConventionalScoring: false,
  },
  hanabi: {
    usesTimer: false,
    hasGameplayHistory: true,
    hasEndReview: true,
    hasConventionalScoring: true,
  },
  crew: {
    usesTimer: false,
    hasGameplayHistory: true,
    hasEndReview: true,
    hasConventionalScoring: false,
  },
};

/**
 * Expanded How to Play — distinct from the catalog short description.
 * Presented via GameInfo; not Markdown.
 */
export type GameHowToPlay = {
  objective: string;
  turnStructure?: string;
  specialRules?: string;
  winCondition?: string;
};

const HOW_TO_PLAY: Record<GameId, GameHowToPlay> = {
  pictionary: {
    objective: "Draw the secret word so the other players can guess it.",
    turnStructure:
      "One player draws while everyone else guesses. Rotate between players.",
    winCondition: "The game ends after each player has had a turn drawing.",
  },
  telestrations: {
    objective:
      "Pass a prompt around the table through alternating drawings and guesses.",
    turnStructure:
      "Draw what you see or read, then pass; next players guess or draw in turn.",
    winCondition: "When the round finishes, reveal each telephone chain.",
  },
  fakeArtist: {
    objective:
      "Artists share a secret title; the Fake Artist must blend in without knowing it.",
    turnStructure:
      "Take turns adding one stroke, then vote for the Fake Artist and (if needed) guess the title.",
    winCondition:
      "Artists win by catching the Fake Artist; the Fake Artist wins by surviving or guessing correctly.",
  },
  hanabi: {
    objective:
      "Cooperate to play fireworks in order—you can see others’ cards, not your own.",
    turnStructure: "On your turn: give a clue, play a card, or discard.",
    winCondition:
      "The team score is the sum of completed firework stacks (max 25).",
  },
  crew: {
    objective:
      "Complete the mission tasks together using careful play and limited communication.",
    turnStructure:
      "Review tasks, optionally communicate once, then play tricks following suit.",
    winCondition: "Succeed or fail the mission—there is no numeric score.",
  },
};

export function gameNightMeta(gameId: GameId): GameNightMeta {
  const entry = GAME_CATALOG.find((game) => game.id === gameId);
  if (!entry) {
    throw new Error(`Unknown game: ${gameId}`);
  }
  const genre = HOME_GAME_GENRE[gameId];
  return {
    ...entry,
    genre: genre.genre,
    genreLabel: genre.label,
    ...UX_FLAGS[gameId],
  };
}

export function gameHowToPlay(gameId: GameId): GameHowToPlay {
  return HOW_TO_PLAY[gameId];
}
