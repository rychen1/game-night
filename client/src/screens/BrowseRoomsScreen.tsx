import { useEffect } from "react";
import type { RoomListItem } from "../network/messages.ts";
import { ActionFeedback } from "../components/ActionFeedback.tsx";

type BrowseRoomsScreenProps = {
  name: string;
  connected: boolean;
  error: string | null;
  rooms: RoomListItem[];
  onNameChange: (name: string) => void;
  onRefresh: () => void;
  onJoinRoom: (roomCode: string) => void;
  onBack: () => void;
};

function statusLabel(status: RoomListItem["status"]): string {
  if (status === "LOBBY") {
    return "Lobby";
  }
  if (status === "GAME_RUNNING") {
    return "In game";
  }
  return "Game over";
}

function joinDisabledReason(room: RoomListItem): string | null {
  if (room.joinable) {
    return null;
  }
  if (room.status !== "LOBBY") {
    return room.status === "GAME_RUNNING" ? "In game" : "Game over";
  }
  return "Full";
}

export function BrowseRoomsScreen({
  name,
  connected,
  error,
  rooms,
  onNameChange,
  onRefresh,
  onJoinRoom,
  onBack,
}: BrowseRoomsScreenProps) {
  const ready = connected && name.trim().length > 0;

  useEffect(() => {
    onRefresh();
    const id = window.setInterval(() => {
      onRefresh();
    }, 3000);
    return () => {
      window.clearInterval(id);
    };
  }, [onRefresh]);

  return (
    <main className="page">
      <h1>Browse rooms</h1>
      <p className="lede">Public rooms currently on this server.</p>

      <section className="panel">
        <label>
          Your name
          <input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            maxLength={32}
            autoComplete="nickname"
          />
        </label>

        <div className="vote-row">
          <button type="button" className="secondary" onClick={onBack}>
            Back
          </button>
          <button type="button" disabled={!connected} onClick={onRefresh}>
            Refresh
          </button>
        </div>

        {rooms.length === 0 ? (
          <p className="status">No rooms right now. Create one from the home screen.</p>
        ) : (
          <ul className="player-list room-browser-list">
            {rooms.map((room) => {
              const reason = joinDisabledReason(room);
              const gameLabel =
                room.setup?.title ?? room.gameTitle ?? "Open lobby";
              return (
                <li key={room.roomCode}>
                  <div>
                    <strong className="room-code">{room.roomCode}</strong>
                    <span className="tags">
                      <em>{statusLabel(room.status)}</em>
                      <em>
                        {room.playerCount}/{room.maxPlayers}
                      </em>
                    </span>
                    <p className="status">
                      {gameLabel}
                      {room.setup ? " · configuring" : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!ready || !room.joinable}
                    onClick={() => onJoinRoom(room.roomCode)}
                    title={reason ?? "Join room"}
                  >
                    {room.joinable ? "Join" : reason}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <ActionFeedback message={error} />
      </section>
    </main>
  );
}
