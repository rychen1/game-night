import type {
  GameId,
  GameSettings,
  GameSetupField,
  GameSetupView,
} from "../protocol/messages.ts";
import { parseGameSettings } from "../protocol/messages.ts";
import type { Game } from "./Game.ts";
import { CrewGame } from "./crew/CrewGame.ts";
import { FakeArtistGame } from "./fakeArtist/FakeArtistGame.ts";
import { HanabiGame } from "./hanabi/HanabiGame.ts";
import { PictionaryGame } from "./pictionary/PictionaryGame.ts";
import { TelestrationsGame } from "./telestrations/TelestrationsGame.ts";
import { WavelengthGame } from "./wavelength/WavelengthGame.ts";
import { TheGangGame } from "./theGang/TheGangGame.ts";

type GameMeta = {
  title: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  fields: GameSetupField[];
  create: (settings: GameSettings) => Game;
};

const GAMES: Record<GameId, GameMeta> = {
  fakeArtist: {
    title: "Fake Artist",
    description:
      "One player is the Fake Artist. Everyone else knows the secret title.",
    minPlayers: 3,
    maxPlayers: 10,
    fields: [],
    create: () => new FakeArtistGame(),
  },
  telestrations: {
    title: "Telestrations",
    description:
      "Pass prompts around the table: draw, guess, and draw again.",
    minPlayers: 3,
    maxPlayers: 10,
    fields: [],
    create: () => new TelestrationsGame(),
  },
  pictionary: {
    title: "Pictionary",
    description:
      "One player draws a secret word while everyone else guesses.",
    minPlayers: 3,
    maxPlayers: 10,
    fields: [],
    create: () => new PictionaryGame(),
  },
  hanabi: {
    title: "Hanabi",
    description:
      "Cooperative fireworks: clue teammates, play carefully, and finish the stacks.",
    minPlayers: 2,
    maxPlayers: 5,
    fields: [],
    create: () => new HanabiGame(),
  },
  crew: {
    title: "The Crew: Mission Deep Sea",
    description: "Cooperative trick-taking with limited communication.",
    minPlayers: 2,
    maxPlayers: 5,
    fields: [],
    create: () => new CrewGame(),
  },
  wavelength: {
    title: "Wavelength",
    description:
      "Give a clue on a spectrum; teammates guess where the hidden target lies.",
    minPlayers: 3,
    maxPlayers: 10,
    fields: [],
    create: () => new WavelengthGame(),
  },
  theGang: {
    title: "The Gang",
    description:
      "Cooperative Texas Hold'em: rank your hand with chips and pull off three heists.",
    minPlayers: 3,
    maxPlayers: 6,
    fields: [
      {
        key: "mode",
        type: "select",
        label: "Mode",
        options: [
          { value: "basic", label: "Basic" },
          { value: "advanced", label: "Advanced" },
          { value: "professional", label: "Professional" },
          { value: "masterThief", label: "Master Thief" },
        ],
      },
    ],
    create: (settings) => {
      if (settings.kind !== "theGang") {
        throw new Error("Invalid settings for The Gang");
      }
      return new TheGangGame(settings.mode);
    },
  },
};

export function defaultSettings(gameId: GameId): GameSettings {
  if (gameId === "theGang") {
    return { kind: "theGang", mode: "basic" };
  }
  return { kind: gameId };
}

export function validateSettings(
  gameId: GameId,
  value: unknown,
): GameSettings | null {
  const settings = parseGameSettings(value);
  if (!settings || settings.kind !== gameId) {
    return null;
  }
  return settings;
}

export function describeSetup(
  gameId: GameId,
  settings: GameSettings,
): GameSetupView {
  const meta = GAMES[gameId];
  const validated = validateSettings(gameId, settings);
  if (!validated) {
    throw new Error("Invalid game settings");
  }
  return {
    gameId,
    title: meta.title,
    description: meta.description,
    minPlayers: meta.minPlayers,
    maxPlayers: meta.maxPlayers,
    settings: validated,
    fields: meta.fields.map((field) => ({ ...field })),
  };
}

export function createGame(gameId: GameId, settings: GameSettings): Game {
  const validated = validateSettings(gameId, settings);
  if (!validated) {
    throw new Error("Invalid game settings");
  }
  return GAMES[gameId].create(validated);
}

/** Highest maxPlayers among registered games — lobby cap when no game is selected. */
export const LOBBY_MAX_PLAYERS = 10;

export function maxPlayersForGame(gameId: GameId): number {
  return GAMES[gameId].maxPlayers;
}

export function gameTitle(gameId: GameId): string {
  return GAMES[gameId].title;
}

export function getGameMeta(gameId: GameId): Omit<GameMeta, "create"> {
  const meta = GAMES[gameId];
  return {
    title: meta.title,
    description: meta.description,
    minPlayers: meta.minPlayers,
    maxPlayers: meta.maxPlayers,
    fields: meta.fields.map((field) => ({ ...field })),
  };
}
