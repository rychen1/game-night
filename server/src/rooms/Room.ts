import type { Game } from "../games/Game.ts";
import type { Player } from "../players/Player.ts";
import type {
  GameId,
  GameSettings,
  RoomPhase,
  RoomVisibility,
} from "../protocol/messages.ts";

export type Room = {
  code: string;
  hostPlayerId: string;
  players: Map<string, Player>;
  phase: RoomPhase;
  visibility: RoomVisibility;
  passwordHash: string | null;
  gameId: GameId | null;
  gameSettings: GameSettings | null;
  setup: { gameId: GameId; settings: GameSettings } | null;
  game: Game | null;
};
