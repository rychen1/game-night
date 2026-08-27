import type { GameId } from "../network/messages.ts";

export type GameCatalogEntry = {
  id: GameId;
  title: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
};

export const GAME_CATALOG: GameCatalogEntry[] = [
  {
    id: "pictionary",
    title: "Pictionary",
    description:
      "One player draws a secret word while everyone else guesses.",
    minPlayers: 3,
    maxPlayers: 10,
  },
  {
    id: "telestrations",
    title: "Telestrations",
    description:
      "Pass prompts around the table: draw, guess, and draw again.",
    minPlayers: 3,
    maxPlayers: 10,
  },
  {
    id: "fakeArtist",
    title: "Fake Artist",
    description:
      "One player is the Fake Artist. Everyone else knows the secret title.",
    minPlayers: 3,
    maxPlayers: 10,
  },
  {
    id: "hanabi",
    title: "Hanabi",
    description:
      "Cooperative fireworks: clue teammates, play carefully, and finish the stacks.",
    minPlayers: 2,
    maxPlayers: 5,
  },
  {
    id: "crew",
    title: "The Crew: Mission Deep Sea",
    description: "Cooperative trick-taking with limited communication.",
    minPlayers: 2,
    maxPlayers: 5,
  },
  {
    id: "wavelength",
    title: "Wavelength",
    description:
      "Give a clue on a spectrum; teammates guess where the hidden target lies.",
    minPlayers: 3,
    maxPlayers: 10,
  },
  {
    id: "theGang",
    title: "The Gang",
    description:
      "Cooperative Texas Hold'em: rank your hand with chips and pull off three heists.",
    minPlayers: 3,
    maxPlayers: 6,
  },
];

export type GameGenre = "drawingGuessing" | "cooperative";

export type GameGenreInfo = {
  genre: GameGenre;
  label: string;
};

export const HOME_GAME_GENRE: Record<GameId, GameGenreInfo> = {
  pictionary: { genre: "drawingGuessing", label: "Drawing & Guessing" },
  telestrations: { genre: "drawingGuessing", label: "Drawing & Guessing" },
  fakeArtist: { genre: "drawingGuessing", label: "Drawing & Guessing" },
  hanabi: { genre: "cooperative", label: "Cooperative" },
  crew: { genre: "cooperative", label: "Cooperative" },
  wavelength: { genre: "drawingGuessing", label: "Party & Guessing" },
  theGang: { genre: "cooperative", label: "Cooperative" },
};

/** Home launcher display order (two-column grid: row-major). */
export const HOME_GAME_ORDER: GameId[] = [
  "pictionary",
  "telestrations",
  "fakeArtist",
  "wavelength",
  "theGang",
  "hanabi",
  "crew",
];

export function homeGameCatalog(): GameCatalogEntry[] {
  return HOME_GAME_ORDER.map((id) => gameCatalogEntry(id));
}

export function homeGameGenre(gameId: GameId): GameGenreInfo {
  return HOME_GAME_GENRE[gameId];
}

export function gameCatalogEntry(gameId: GameId): GameCatalogEntry {
  const entry = GAME_CATALOG.find((game) => game.id === gameId);
  if (!entry) {
    throw new Error(`Unknown game: ${gameId}`);
  }
  return entry;
}
