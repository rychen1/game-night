import type {
  GameAction,
  PrivateGameState,
  PublicGameState,
} from "../protocol/messages.ts";

export class GameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GameError";
  }
}

export type Game = {
  setup(playerIds: string[]): void;
  canStart(playerCount: number): string | null;
  getPublicState(): PublicGameState;
  getPrivateState(playerId: string): PrivateGameState;
  performAction(playerId: string, action: GameAction): void;
  onPlayerRemoved(playerId: string): void;
  isGameOver(): boolean;
  /**
   * Epoch ms when the current timed phase ends, or null if untimed.
   * RoomManager schedules a generic one-shot from this value; games own the deadline.
   */
  getTimerDeadline(): number | null;
  /**
   * Server deadline fired. Modules must advance via existing phase transitions
   * if the deadline still applies; clients never call this.
   */
  onTimer(): void;
};
