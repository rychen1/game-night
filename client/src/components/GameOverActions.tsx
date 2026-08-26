import type { PublicPlayer } from "../network/messages.ts";
import { RoomReadyControls } from "./RoomReadyControls.tsx";

type GameOverActionsProps = {
  playerId: string;
  players: PublicPlayer[];
  isHost: boolean;
  onSetReady: (ready: boolean) => void;
  onPlayAgain: () => void;
  onReturnToLobby: () => void;
};

/** Shared Play Again readiness + host Return to Lobby (all games). */
export function GameOverActions({
  playerId,
  players,
  isHost,
  onSetReady,
  onPlayAgain,
  onReturnToLobby,
}: GameOverActionsProps) {
  return (
    <RoomReadyControls
      playerId={playerId}
      players={players}
      isHost={isHost}
      proceedLabel="Play Again"
      onSetReady={onSetReady}
      onProceed={onPlayAgain}
      secondaryLabel="Return to lobby"
      onSecondary={onReturnToLobby}
    />
  );
}
