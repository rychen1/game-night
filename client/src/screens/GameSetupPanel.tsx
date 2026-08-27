import type { GameSettings, GameSetupView } from "../network/messages.ts";
import { GameInfo } from "../components/GameInfo.tsx";
import {
  configurationForSetup,
  updateSetupSettings,
} from "../games/theGang/setup.ts";

type GameSetupPanelProps = {
  setup: GameSetupView;
  isHost?: boolean;
  onUpdateSettings?: (settings: GameSettings) => void;
};

/**
 * Game Information for lobby setup (title, description, How to Play, config).
 * Live players / readiness belong in RoomPlayersSection — not here.
 */
export function GameSetupPanel({
  setup,
  isHost = false,
  onUpdateSettings,
}: GameSetupPanelProps) {
  const configuration = configurationForSetup(setup);

  return (
    <>
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
        configuration={configuration}
      />
      {isHost && setup.fields.length > 0 ? (
        <div className="game-setup-fields section-stack">
          {setup.fields.map((field) => {
            if (field.type !== "select") {
              return null;
            }
            const currentValue =
              setup.settings.kind === "theGang" && field.key === "mode"
                ? setup.settings.mode
                : (field.options[0]?.value ?? "");
            return (
              <label key={field.key} className="game-setup-field">
                <span className="game-setup-field__label">{field.label}</span>
                <select
                  className="game-setup-field__control"
                  value={currentValue}
                  onChange={(event) => {
                    const next = updateSetupSettings(
                      setup,
                      field.key,
                      event.target.value,
                    );
                    if (next) {
                      onUpdateSettings?.(next);
                    }
                  }}
                >
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
