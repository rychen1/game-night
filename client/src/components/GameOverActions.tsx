import type { GameId, PublicPlayer } from "../network/messages.ts";
import { gameCatalogEntry } from "../games/catalog.ts";
import { RoomPlayersSection } from "./RoomPlayersSection.tsx";

type GameOverActionsProps = {
  gameId: GameId;
  playerId: string;
  players: PublicPlayer[];
  isHost: boolean;
  onSetReady: (ready: boolean) => void;
  onPlayAgain: () => void;
  onReturnToLobby: () => void;
};

/** Shared Play Again readiness + host Return to Lobby (all games). */
export function GameOverActions({
  gameId,
  playerId,
  players,
  isHost,
  onSetReady,
  onPlayAgain,
  onReturnToLobby,
}: GameOverActionsProps) {
  const { minPlayers, maxPlayers } = gameCatalogEntry(gameId);
  const seatedCount = players.length;
  const inRange = seatedCount >= minPlayers && seatedCount <= maxPlayers;

  return (
    <RoomPlayersSection
      players={players}
      playerId={playerId}
      minPlayers={minPlayers}
      maxPlayers={maxPlayers}
      readiness={{
        isHost,
        canStart: inRange,
        proceedLabel: "Play Again",
        onSetReady,
        onProceed: onPlayAgain,
        secondaryLabel: "Return to lobby",
        onSecondary: onReturnToLobby,
      }}
    />
  );
}
