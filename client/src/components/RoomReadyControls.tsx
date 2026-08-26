import type { PublicPlayer } from "../network/messages.ts";

type RoomReadyControlsProps = {
  playerId: string;
  players: PublicPlayer[];
  isHost: boolean;
  /** Extra gate for Start Game (player-count range). Defaults to true. */
  canStart?: boolean;
  proceedLabel: "Start Game" | "Play Again";
  onSetReady: (ready: boolean) => void;
  onProceed: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** When false, omit the per-player ready list (e.g. already shown above). */
  showPlayerList?: boolean;
  showHeading?: boolean;
  showReadyCount?: boolean;
};

export function readyCounts(players: PublicPlayer[]): {
  readyCount: number;
  total: number;
  allReady: boolean;
} {
  const total = players.length;
  const readyCount = players.filter((player) => player.ready).length;
  return {
    readyCount,
    total,
    allReady: total > 0 && readyCount === total,
  };
}

/**
 * Shared readiness controls for lobby Start Game and post-game Play Again.
 * Prefer embedding via RoomPlayersSection in setup so players + ready stay one section.
 */
export function RoomReadyControls({
  playerId,
  players,
  isHost,
  canStart = true,
  proceedLabel,
  onSetReady,
  onProceed,
  secondaryLabel,
  onSecondary,
  showPlayerList = true,
  showHeading = true,
  showReadyCount = true,
}: RoomReadyControlsProps) {
  const self = players.find((player) => player.id === playerId);
  const selfReady = self?.ready ?? false;
  const { readyCount, total, allReady } = readyCounts(players);
  const proceedEnabled = isHost && allReady && canStart;

  return (
    <div className="room-ready">
      {showHeading ? (
        <h3 className="room-ready__heading">Ready check</h3>
      ) : null}
      {showPlayerList ? (
        <ul className="room-ready__list">
          {players.map((player) => (
            <li key={player.id}>
              <span>{player.name}</span>
              <em className={player.ready ? "ok" : "off"}>
                {player.ready ? "Ready" : "Waiting"}
              </em>
            </li>
          ))}
        </ul>
      ) : null}
      {showReadyCount ? (
        <p className="status">
          {readyCount} / {total} ready
        </p>
      ) : null}
      <div className="vote-row">
        <button
          type="button"
          className={selfReady ? "secondary" : undefined}
          onClick={() => onSetReady(!selfReady)}
        >
          {selfReady ? "Not Ready" : "Ready"}
        </button>
        {isHost && onSecondary && secondaryLabel ? (
          <button type="button" className="secondary" onClick={onSecondary}>
            {secondaryLabel}
          </button>
        ) : null}
        {isHost ? (
          <button
            type="button"
            disabled={!proceedEnabled}
            onClick={onProceed}
          >
            {proceedLabel}
          </button>
        ) : null}
      </div>
      {!isHost ? (
        <p className="status">
          Waiting for the host to{" "}
          {proceedLabel === "Start Game" ? "start" : "start another game"}
          {allReady ? "." : " once everyone is ready."}
        </p>
      ) : null}
    </div>
  );
}
