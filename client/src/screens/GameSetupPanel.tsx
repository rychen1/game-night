import type { GameSetupView } from "../network/messages.ts";
import { GameInfo } from "../components/GameInfo.tsx";

type GameSetupPanelProps = {
  setup: GameSetupView;
};

/**
 * Game Information for lobby setup (title, description, How to Play, config).
 * Live players / readiness belong in RoomPlayersSection — not here.
 */
export function GameSetupPanel({ setup }: GameSetupPanelProps) {
  return (
    <GameInfo
      gameId={setup.gameId}
      title={setup.title}
      description={setup.description}
      minPlayers={setup.minPlayers}
      maxPlayers={setup.maxPlayers}
      showSummary
      showPlayerRange={false}
      showHowToPlay
      showConfiguration
      configuration={{ label: "Standard" }}
    />
  );
}
