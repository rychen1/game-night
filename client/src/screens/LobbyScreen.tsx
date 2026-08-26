import { useState } from "react";
import type {
  GameId,
  PrivateGameState,
  RoomStatePayload,
} from "../network/messages.ts";
import { ActionFeedback } from "../components/ActionFeedback.tsx";
import { GamePickerGrid } from "../components/GamePickerGrid.tsx";
import { RoomPlayersSection } from "../components/RoomPlayersSection.tsx";
import { SectionPanel } from "../components/SectionPanel.tsx";
import { WaitingStatus } from "../components/WaitingStatus.tsx";
import { GameSetupPanel } from "./GameSetupPanel.tsx";

type LobbyScreenProps = {
  playerId: string;
  name: string;
  room: RoomStatePayload;
  privateState: PrivateGameState | null;
  error: string | null;
  onNameChange: (name: string) => void;
  onSetName: () => void;
  onSelectGame: (gameId: GameId) => void;
  onCancelSetup: () => void;
  onStartGame: () => void;
  onSetReady: (ready: boolean) => void;
  onLeaveRoom: () => void;
  onRemovePlayer: (playerId: string) => void;
};

export function LobbyScreen({
  playerId,
  name,
  room,
  privateState,
  error,
  onNameChange,
  onSetName,
  onSelectGame,
  onCancelSetup,
  onStartGame,
  onSetReady,
  onLeaveRoom,
  onRemovePlayer,
}: LobbyScreenProps) {
  const [editingName, setEditingName] = useState(false);
  const self = room.players.find((player) => player.id === playerId);
  const isHost = self?.isHost ?? false;
  const setup = room.setup;
  const inSetup =
    room.phase === "LOBBY" && setup !== undefined && setup !== null;

  const statusText =
    room.phase === "GAME_RUNNING"
      ? "Game in progress."
      : room.phase === "GAME_OVER"
        ? "Game over."
        : null;
  const showLede = room.visibility === "private" || statusText !== null;

  return (
    <main className="page">
      <header className="lobby-header">
        <h1>Room Lobby</h1>
        <p className="lobby-room-code">
          Room code: <span className="room-code">{room.roomCode}</span>
        </p>
      </header>
      {showLede ? (
        <p className="lede">
          {room.visibility === "private" ? (
            <span className="tags">
              <em>private</em>
            </span>
          ) : null}
          {room.visibility === "private" && statusText ? " " : null}
          {statusText}
        </p>
      ) : null}

      <div className="game-stack">
        {inSetup && setup ? (
          <SectionPanel aria-label="Game information">
            <GameSetupPanel setup={setup} />
          </SectionPanel>
        ) : null}

        <SectionPanel aria-label="Players" emphasis={inSetup}>
          <RoomPlayersSection
            players={room.players}
            playerId={playerId}
            minPlayers={inSetup && setup ? setup.minPlayers : undefined}
            maxPlayers={inSetup && setup ? setup.maxPlayers : undefined}
            showReady={inSetup}
            nameEdit={{
              draft: name,
              onDraftChange: onNameChange,
              onSubmit: onSetName,
            }}
            editingName={editingName}
            onEditingNameChange={setEditingName}
            onRemovePlayer={isHost ? onRemovePlayer : undefined}
            readiness={
              inSetup && setup
                ? {
                    isHost,
                    canStart:
                      room.players.length >= setup.minPlayers &&
                      room.players.length <= setup.maxPlayers,
                    proceedLabel: "Start Game",
                    onSetReady,
                    onProceed: onStartGame,
                    secondaryLabel: "Change Game",
                    onSecondary: onCancelSetup,
                  }
                : undefined
            }
          />
        </SectionPanel>

        {isHost && room.phase === "LOBBY" && !setup ? (
          <SectionPanel aria-label="Choose a game">
            <GamePickerGrid
              heading="Choose a game"
              onSelect={onSelectGame}
            />
          </SectionPanel>
        ) : null}

        {!isHost && room.phase === "LOBBY" && !setup ? (
          <SectionPanel aria-label="Waiting">
            <WaitingStatus message="Waiting for the host to choose a game…" />
          </SectionPanel>
        ) : null}

        {room.publicGame?.kind === "dummy" ? (
          <SectionPanel aria-label="Public state">
            <div className="game-box">
              <h2>Public state</h2>
              <p>
                {room.publicGame.label} — everyone in the room can see this.
              </p>
            </div>
          </SectionPanel>
        ) : null}

        {privateState?.kind === "dummy" ? (
          <SectionPanel aria-label="Private state">
            <div className="game-box">
              <h2>Your private state</h2>
              <p>
                Secret number: <code>{privateState.secret}</code>
              </p>
              <p className="status">Other players cannot see this value.</p>
            </div>
          </SectionPanel>
        ) : null}

        <SectionPanel aria-label="Room">
          <ActionFeedback message={error} />

          <button type="button" className="secondary" onClick={onLeaveRoom}>
            Leave room
          </button>
        </SectionPanel>
      </div>
    </main>
  );
}
