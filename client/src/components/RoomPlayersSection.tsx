import type { ReactNode } from "react";
import type { PublicPlayer } from "../network/messages.ts";
import {
  GamePlayerList,
  type PlayerNameEdit,
} from "./GamePlayerList.tsx";
import {
  readyCounts,
  RoomReadyControls,
} from "./RoomReadyControls.tsx";

export type RoomPlayersReadiness = {
  isHost: boolean;
  /** Extra gate for Start (e.g. player-count in range). Defaults to true. */
  canStart?: boolean;
  proceedLabel: "Start Game" | "Play Again";
  onSetReady: (ready: boolean) => void;
  onProceed: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

type RoomPlayersSectionProps = {
  players: PublicPlayer[];
  playerId: string;
  /** Registry launch threshold — “need more” / can-start gating. */
  minPlayers?: number;
  /** Registry room capacity — full lobby messaging + join limit (server). */
  maxPlayers?: number;
  showReady?: boolean;
  renderExtraTags?: (player: PublicPlayer) => ReactNode;
  readiness?: RoomPlayersReadiness;
  /** Inline display-name edit for the current player. */
  nameEdit?: PlayerNameEdit;
  editingName?: boolean;
  onEditingNameChange?: (editing: boolean) => void;
  /** Host-only remove of another seated player. */
  onRemovePlayer?: (playerId: string) => void;
  className?: string;
};

type OccupancyStatus = {
  /** Launch / capacity guidance — not the static game range. */
  text: string;
  /** False when the room cannot start (below min or over max). */
  ok: boolean;
};

/**
 * Current room occupancy messaging from registry min/max.
 * Does not repeat the game's static range (that lives in Game Information).
 */
function occupancyStatus(
  seatedCount: number,
  minPlayers: number,
  maxPlayers: number,
): OccupancyStatus {
  if (seatedCount < minPlayers) {
    const need = minPlayers - seatedCount;
    return {
      ok: false,
      text: need === 1 ? "Need 1 more player" : `Need ${need} more players`,
    };
  }
  if (seatedCount > maxPlayers) {
    return {
      ok: false,
      text: `Too many players (max ${maxPlayers})`,
    };
  }
  if (seatedCount >= maxPlayers) {
    return {
      ok: true,
      text: "Lobby full",
    };
  }
  return {
    ok: true,
    text: "Ready when everyone is ready",
  };
}

/**
 * Shared Room Lobby Players area.
 * Hierarchy: Players → list → capacity/launch status → ready count → actions.
 * No separate “Ready” section heading.
 *
 * minPlayers = launch threshold; maxPlayers = room capacity (registry).
 */
export function RoomPlayersSection({
  players,
  playerId,
  minPlayers,
  maxPlayers,
  showReady = false,
  renderExtraTags,
  readiness,
  nameEdit,
  editingName,
  onEditingNameChange,
  onRemovePlayer,
  className,
}: RoomPlayersSectionProps) {
  const seatedCount = players.length;
  const hasRange = minPlayers !== undefined && maxPlayers !== undefined;
  const occupancy = hasRange
    ? occupancyStatus(seatedCount, minPlayers, maxPlayers)
    : null;
  const { readyCount, total } = readyCounts(players);
  const inRange =
    !hasRange ||
    (seatedCount >= minPlayers && seatedCount <= maxPlayers);
  const showCapacityStatus =
    hasRange && (Boolean(readiness) || Boolean(occupancy && !occupancy.ok));

  return (
    <div
      className={["room-players", "section-stack", className]
        .filter(Boolean)
        .join(" ")}
    >
      <h2 className="section-heading room-players__title">Players</h2>

      <div className="section-content room-players__list">
        <GamePlayerList
          players={players}
          playerId={playerId}
          showReady={showReady || Boolean(readiness)}
          showConnection={readiness ? "whenDisconnected" : true}
          nameEdit={nameEdit}
          editingName={editingName}
          onEditingNameChange={onEditingNameChange}
          onRemovePlayer={onRemovePlayer}
          renderExtraTags={renderExtraTags}
          heading=""
        />
      </div>

      {showCapacityStatus && occupancy ? (
        <p
          className={
            occupancy.ok
              ? "section-status room-players__occupancy"
              : "section-status error room-players__occupancy"
          }
        >
          {occupancy.text}
        </p>
      ) : null}

      {readiness ? (
        <div className="room-players__actions">
          <p className="section-status room-players__ready-count">
            {readyCount} / {total} ready
          </p>
          <RoomReadyControls
            playerId={playerId}
            players={players}
            isHost={readiness.isHost}
            canStart={readiness.canStart ?? inRange}
            proceedLabel={readiness.proceedLabel}
            onSetReady={readiness.onSetReady}
            onProceed={readiness.onProceed}
            secondaryLabel={readiness.secondaryLabel}
            onSecondary={readiness.onSecondary}
            showPlayerList={false}
            showHeading={false}
            showReadyCount={false}
          />
        </div>
      ) : null}
    </div>
  );
}
