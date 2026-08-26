import type { GameId } from "../network/messages.ts";
import { GameInfo } from "./GameInfo.tsx";

type HowToPlayProps = {
  gameId: GameId;
  className?: string;
};

/**
 * In-game How to Play disclosure — thin wrapper around GameInfo.
 * Prefer GameInfo directly when you also need summary/configuration.
 */
export function HowToPlay({ gameId, className }: HowToPlayProps) {
  return (
    <GameInfo
      gameId={gameId}
      showSummary={false}
      showHowToPlay
      className={className}
    />
  );
}
