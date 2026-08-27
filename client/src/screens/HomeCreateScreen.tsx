import type { GameId, RoomVisibility } from "../network/messages.ts";
import { ActionFeedback } from "../components/ActionFeedback.tsx";
import { GameInfo } from "../components/GameInfo.tsx";
import { configurationForGameId } from "../games/theGang/setup.ts";
import { RoomVisibilityFields } from "../components/RoomVisibilityFields.tsx";
import { SectionPanel } from "../components/SectionPanel.tsx";

type HomeCreateScreenProps = {
  gameId: GameId;
  name: string;
  visibility: RoomVisibility;
  createPassword: string;
  connected: boolean;
  error: string | null;
  onNameChange: (name: string) => void;
  onVisibilityChange: (visibility: RoomVisibility) => void;
  onCreatePasswordChange: (password: string) => void;
  onBack: () => void;
  onCreate: () => void;
};

export function HomeCreateScreen({
  gameId,
  name,
  visibility,
  createPassword,
  connected,
  error,
  onNameChange,
  onVisibilityChange,
  onCreatePasswordChange,
  onBack,
  onCreate,
}: HomeCreateScreenProps) {
  const ready = connected && name.trim().length > 0;
  const canCreate =
    ready && (visibility === "public" || createPassword.length > 0);

  return (
    <main className="page home-page">
      <header className="home-intro">
        <h1>Game Night</h1>
        <p className="home-tagline">Games for a table full of friends.</p>
      </header>

      <div className="game-stack home-create-stack">
        <button type="button" className="secondary home-back" onClick={onBack}>
          Back
        </button>

        <SectionPanel aria-label="Game information">
          <GameInfo
            gameId={gameId}
            showSummary
            showPlayerRange
            showHowToPlay
            showConfiguration
            configuration={configurationForGameId(gameId)}
          />
        </SectionPanel>

        <SectionPanel aria-label="Room">
          <form
            className="home-create-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (canCreate) {
                onCreate();
              }
            }}
          >
            <h2 className="room-create__title">Room</h2>

            <label>
              Your name
              <input
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                maxLength={32}
                autoComplete="nickname"
              />
            </label>

            <RoomVisibilityFields
              visibility={visibility}
              password={createPassword}
              onVisibilityChange={onVisibilityChange}
              onPasswordChange={onCreatePasswordChange}
            />

            <button type="submit" disabled={!canCreate}>
              Create room
            </button>
          </form>
        </SectionPanel>

        {error ? (
          <SectionPanel aria-label="Status">
            <ActionFeedback message={error} />
          </SectionPanel>
        ) : null}
      </div>
    </main>
  );
}
