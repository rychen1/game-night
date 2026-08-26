import type {
  DummyPrivateState,
  DummyPublicState,
  GameAction,
} from "../protocol/messages.ts";
import { GameError, type Game } from "./Game.ts";

export class DummyGame implements Game {
  private secrets = new Map<string, string>();

  canStart(_playerCount: number): string | null {
    return null;
  }

  setup(playerIds: string[]): void {
    this.secrets.clear();
    for (const playerId of playerIds) {
      const secret = String(100 + Math.floor(Math.random() * 900));
      this.secrets.set(playerId, secret);
    }
  }

  getPublicState(): DummyPublicState {
    return { kind: "dummy", label: "Secret numbers" };
  }

  getPrivateState(playerId: string): DummyPrivateState {
    const secret = this.secrets.get(playerId);
    return {
      kind: "dummy",
      secret: secret ?? "(no secret)",
    };
  }

  performAction(_playerId: string, _action: GameAction): void {
    throw new GameError("This game does not accept actions");
  }

  onPlayerRemoved(playerId: string): void {
    this.secrets.delete(playerId);
  }

  isGameOver(): boolean {
    return false;
  }

  getTimerDeadline(): number | null {
    return null;
  }

  onTimer(): void {}
}
