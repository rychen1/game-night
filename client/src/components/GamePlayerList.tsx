import type { ReactNode } from "react";
import type { PublicPlayer } from "../network/messages.ts";

export type PlayerNameEdit = {
  draft: string;
  onDraftChange: (name: string) => void;
  onSubmit: () => void;
};

type GamePlayerListProps = {
  players: PublicPlayer[];
  playerId: string;
  /** Show Ready / Waiting badges (setup / game-over ready-check). */
  showReady?: boolean;
  /**
   * Connection badges: always | only when disconnected | never.
   * Lobby setup prefers "whenDisconnected" to avoid repeating Connected.
   */
  showConnection?: boolean | "whenDisconnected";
  /** Inline display-name edit for the current player (Room Lobby). */
  nameEdit?: PlayerNameEdit;
  /** Whether the current player is editing their name. */
  editingName?: boolean;
  onEditingNameChange?: (editing: boolean) => void;
  /**
   * Host-only remove of another seated player (Room Lobby).
   * Omit for non-hosts / game footers — control is not shown.
   */
  onRemovePlayer?: (playerId: string) => void;
  /** Game-specific badges that do not leak hidden information. */
  renderExtraTags?: (player: PublicPlayer) => ReactNode;
  heading?: string;
  className?: string;
};

/**
 * Shared player / seat list for lobby and game footers.
 * Hierarchy: name → you/host/ready → connection (as configured) → game-specific.
 */
export function GamePlayerList({
  players,
  playerId,
  showReady = false,
  showConnection = true,
  nameEdit,
  editingName = false,
  onEditingNameChange,
  onRemovePlayer,
  renderExtraTags,
  heading = "Players",
  className,
}: GamePlayerListProps) {
  const selfIsHost =
    players.find((player) => player.id === playerId)?.isHost === true;

  return (
    <div className={["game-player-list", className].filter(Boolean).join(" ")}>
      {heading ? <h2>{heading}</h2> : null}
      <ul className="player-list">
        {players.map((player) => {
          const isSelf = player.id === playerId;
          const showConnectedBadge =
            showConnection === true ||
            (showConnection === "whenDisconnected" && !player.connected);
          const canEditName = Boolean(nameEdit && isSelf);
          const canRemove =
            Boolean(onRemovePlayer) && selfIsHost && !isSelf;

          return (
            <li key={player.id}>
              {canEditName && editingName && nameEdit ? (
                <form
                  className="player-name-edit"
                  onSubmit={(event) => {
                    event.preventDefault();
                    nameEdit.onSubmit();
                    onEditingNameChange?.(false);
                  }}
                >
                  <label className="player-name-edit__label">
                    <span className="visually-hidden">Display name</span>
                    <input
                      value={nameEdit.draft}
                      onChange={(event) =>
                        nameEdit.onDraftChange(event.target.value)
                      }
                      maxLength={32}
                      autoFocus
                      aria-label="Display name"
                    />
                  </label>
                  <button type="submit">Save</button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => onEditingNameChange?.(false)}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <span className="player-list__identity">
                  <span className="player-list__name">{player.name}</span>
                  {canEditName ? (
                    <button
                      type="button"
                      className="player-name-edit-trigger"
                      aria-label="Edit display name"
                      title="Edit display name"
                      onClick={() => onEditingNameChange?.(true)}
                    >
                      <span
                        className="player-name-edit-trigger__icon"
                        aria-hidden="true"
                      >
                        ✎
                      </span>
                    </button>
                  ) : null}
                  {canRemove ? (
                    <details className="player-actions">
                      <summary
                        className="player-actions__trigger"
                        aria-label={`Actions for ${player.name}`}
                        title="Player actions"
                      >
                        <span aria-hidden="true">⋮</span>
                      </summary>
                      <div className="player-actions__menu" role="menu">
                        <button
                          type="button"
                          className="player-actions__item"
                          role="menuitem"
                          onClick={(event) => {
                            const details = event.currentTarget.closest(
                              "details",
                            );
                            if (details) {
                              details.removeAttribute("open");
                            }
                            onRemovePlayer?.(player.id);
                          }}
                        >
                          Remove player
                        </button>
                      </div>
                    </details>
                  ) : null}
                </span>
              )}
              <span className="tags">
                {isSelf ? <em>you</em> : null}
                {player.isHost ? <em>host</em> : null}
                {showReady ? (
                  <em className={player.ready ? "ok" : "off"}>
                    {player.ready ? "Ready" : "Waiting"}
                  </em>
                ) : null}
                {renderExtraTags?.(player)}
                {showConnectedBadge ? (
                  <em className={player.connected ? "ok" : "off"}>
                    {player.connected ? "connected" : "disconnected"}
                  </em>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
