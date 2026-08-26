import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
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

/** Sync browser autofill into React state when the DOM value diverges. */
function useAutofillSync(
  ref: RefObject<HTMLInputElement | null>,
  value: string,
  onChange: (next: string) => void,
): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (el !== null && el.value !== value) {
      onChange(el.value);
    }
  });

  useEffect(() => {
    const el = ref.current;
    if (el === null) {
      return;
    }
    const sync = (): void => {
      if (el.value !== value) {
        onChange(el.value);
      }
    };
    el.addEventListener("input", sync);
    el.addEventListener("change", sync);
    const timer = window.setTimeout(sync, 250);
    return () => {
      el.removeEventListener("input", sync);
      el.removeEventListener("change", sync);
      window.clearTimeout(timer);
    };
  }, [value, onChange]);
}

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
  const nameRef = useRef<HTMLInputElement>(null);
  const joinCodeRef = useRef<HTMLInputElement>(null);

  useAutofillSync(nameRef, name, onNameChange);
  useAutofillSync(joinCodeRef, joinCode, onJoinCodeChange);

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
        <p className="home-games">
          Pictionary · Telestrations · Fake Artist · Hanabi · The Crew
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
            ref={nameRef}
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            onInput={(event) => onNameChange(event.currentTarget.value)}
            maxLength={32}
            autoComplete="nickname"
          />
        </label>

        <div className="split">
          <label>
            Room code
            <input
              ref={joinCodeRef}
              value={joinCode}
              onChange={(event) => onJoinCodeChange(event.target.value)}
              onInput={(event) => onJoinCodeChange(event.currentTarget.value)}
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
              onInput={(event) =>
                onJoinPasswordChange(event.currentTarget.value)
              }
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
