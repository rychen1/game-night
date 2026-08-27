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
  wavelength: {
    usesTimer: false,
    hasGameplayHistory: true,
    hasEndReview: true,
    hasConventionalScoring: true,
  },
  theGang: {
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

export type OfficialRulebook = {
  url: string;
  /** Player-facing link text (publisher + product). */
  label: string;
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
      "Artists win by catching the Fake Artist. If caught, the Fake Artist wins only by guessing the title incorrectly.",
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
  wavelength: {
    objective:
      "Work together to find a hidden target on a spectrum using a single clue.",
    turnStructure:
      "Each player gives one clue; everyone else guesses where the target lies.",
    winCondition:
      "Score points for accurate guesses across every player's clue-giving turn.",
  },
  theGang: {
    objective:
      "Pull off three heists before three alarms — without discussing your cards.",
    turnStructure:
      "Each heist is a Hold'em hand: choose strength chips at pre-flop, flop, turn, and river.",
    winCondition:
      "Open three vaults (successful heists) before three alarms (failed heists).",
  },
};

const OFFICIAL_RULEBOOKS: Record<GameId, OfficialRulebook> = {
  crew: {
    url: "https://www.thamesandkosmos.co.uk/wp-content/uploads/2021/02/691869_Crew_Deep-Sea_Manual.pdf",
    label: "Thames & Kosmos — The Crew: Mission Deep Sea (PDF)",
  },
  hanabi: {
    url: "https://rnrgames.com/Content/RRGames/images/ProductRules/hanabiRules.PDF",
    label: "R&R Games — Hanabi (PDF)",
  },
  fakeArtist: {
    url: "https://cdn.1j1ju.com/medias/c0/75/df-a-fake-artist-goes-to-new-york-rulebook.pdf",
    label: "Oink Games — A Fake Artist Goes to New York (PDF)",
  },
  pictionary: {
    url: "https://service.mattel.com/instruction_sheets/DKD47-Eng.pdf",
    label: "Mattel — Pictionary (PDF)",
  },
  telestrations: {
    url: "https://cdn.shopify.com/s/files/1/0611/3958/3198/files/Compressed_Telestrations_8P_Rules_2025-1.pdf",
    label: "The Op — Telestrations 8 Player (PDF)",
  },
  wavelength: {
    url: "https://www.wavelength.zone/how-to-play",
    label: "Palm Court — Wavelength (how to play)",
  },
  theGang: {
    url: "https://boardgamegeek.com/boardgame/358861/the-gang",
    label: "BoardGameGeek — The Gang",
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

export function gameOfficialRulebook(gameId: GameId): OfficialRulebook {
  return OFFICIAL_RULEBOOKS[gameId];
}
