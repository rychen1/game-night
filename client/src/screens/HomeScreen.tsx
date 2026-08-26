import type { GameId } from "../network/messages.ts";
import { ActionFeedback } from "../components/ActionFeedback.tsx";
import { GamePickerGrid } from "../components/GamePickerGrid.tsx";
import { isJoinCodeReady } from "../room/roomShare.ts";

type HomeScreenProps = {
  name: string;
  joinCode: string;
  joinPassword: string;
  showJoinPassword: boolean;
  connected: boolean;
  error: string | null;
  onChooseGame: (gameId: GameId) => void;
  onNameChange: (name: string) => void;
  onJoinCodeChange: (code: string) => void;
  onJoinPasswordChange: (password: string) => void;
  onJoin: () => void;
  onBrowseRooms: () => void;
};

export function HomeScreen({
  name,
  joinCode,
  joinPassword,
  showJoinPassword,
  connected,
  error,
  onChooseGame,
  onNameChange,
  onJoinCodeChange,
  onJoinPasswordChange,
  onJoin,
  onBrowseRooms,
}: HomeScreenProps) {
  const ready = connected && name.trim().length > 0;
  const canJoin =
    ready &&
    isJoinCodeReady(joinCode) &&
    (!showJoinPassword || joinPassword.length > 0);

  return (
    <main className="page home-page">
      <header className="home-intro">
        <h1>Game Night</h1>
        <p className="home-tagline">Games for a table full of friends.</p>
        <p className="home-beta-notice">
          Work in progress · Not monetized · Fan project &amp; lab for exploring
          and testing new game ideas
        </p>
      </header>

      <GamePickerGrid
        heading="Choose a game"
        centered
        onSelect={onChooseGame}
      />

      <section className="panel home-secondary">
        <h2 className="home-section-heading home-section-heading--panel">
          Join a room
        </h2>

        <label>
          Your name
          <input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            maxLength={32}
            autoComplete="nickname"
          />
        </label>

        <div className="split">
          <label>
            Room code
            <input
              value={joinCode}
              onChange={(event) => onJoinCodeChange(event.target.value)}
              maxLength={4}
              placeholder="7K4P"
              autoCapitalize="characters"
              spellCheck={false}
            />
          </label>
          <button type="button" disabled={!canJoin} onClick={onJoin}>
            Join
          </button>
        </div>

        {showJoinPassword ? (
          <label>
            Room password
            <input
              type="password"
              value={joinPassword}
              onChange={(event) => onJoinPasswordChange(event.target.value)}
              maxLength={64}
              autoComplete="current-password"
            />
          </label>
        ) : null}

        <button
          type="button"
          className="secondary"
          disabled={!ready}
          title={!name.trim() ? "Enter your name to browse rooms" : undefined}
          onClick={onBrowseRooms}
        >
          Browse rooms
        </button>

        <ActionFeedback message={error} />
      </section>
    </main>
  );
}
