import type { GameId } from "../network/messages.ts";
import { gameCatalogEntry } from "../games/catalog.ts";
import {
  gameHowToPlay,
  type GameHowToPlay,
} from "../games/uxMeta.ts";

export type GameInfoConfiguration = {
  /** Primary label, e.g. "Standard" */
  label: string;
  /** Optional extra explanation — omit for Standard-only games */
  detail?: string;
};

type GameInfoProps = {
  gameId: GameId;
  /** Override title/description/range when setup view is already loaded */
  title?: string;
  description?: string;
  minPlayers?: number;
  maxPlayers?: number;
  /** Show title + short description (+ optional static player range) */
  showSummary?: boolean;
  /**
   * Static catalog range (`3–10 players`). Use on home/create.
   * Omit in active room setup — live count lives in RoomPlayersSection.
   */
  showPlayerRange?: boolean;
  /** Collapsed How to Play disclosure with Objective / Turn / End */
  showHowToPlay?: boolean;
  /** Configuration block (visually separate from How to Play) */
  showConfiguration?: boolean;
  configuration?: GameInfoConfiguration;
  howToPlay?: GameHowToPlay;
  className?: string;
};

function playerRangeLabel(minPlayers: number, maxPlayers: number): string {
  return `${minPlayers}–${maxPlayers} players`;
}

/**
 * Shared game information presentation (not live room state).
 * Games supply structured metadata; the platform owns the layout.
 */
export function GameInfo({
  gameId,
  title: titleOverride,
  description: descriptionOverride,
  minPlayers: minOverride,
  maxPlayers: maxOverride,
  showSummary = true,
  showPlayerRange = true,
  showHowToPlay = false,
  showConfiguration = false,
  configuration = { label: "Standard" },
  howToPlay: howToOverride,
  className,
}: GameInfoProps) {
  const catalog = gameCatalogEntry(gameId);
  const title = titleOverride ?? catalog.title;
  const description = descriptionOverride ?? catalog.description;
  const minPlayers = minOverride ?? catalog.minPlayers;
  const maxPlayers = maxOverride ?? catalog.maxPlayers;
  const howTo = howToOverride ?? gameHowToPlay(gameId);
  const lobbySectionHeadings = showSummary || showConfiguration;

  return (
    <div className={["game-info", className].filter(Boolean).join(" ")}>
      {showSummary ? (
        <header className="game-info__summary">
          <h2 className="game-info__title game-title">{title}</h2>
          <p className="game-info__description section-body">{description}</p>
          {showPlayerRange ? (
            <p className="game-info__players status">
              {playerRangeLabel(minPlayers, maxPlayers)}
            </p>
          ) : null}
        </header>
      ) : null}

      {showHowToPlay ? (
        <details className="game-info__howto how-to-play">
          <summary
            className={[
              "how-to-play__summary",
              lobbySectionHeadings ? "section-heading" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            How to play
          </summary>
          <div className="how-to-play__body game-info__howto-body">
            <section className="game-info__section">
              <h3 className="game-info__label">Objective</h3>
              <p>{howTo.objective}</p>
            </section>
            {howTo.turnStructure ? (
              <section className="game-info__section">
                <h3 className="game-info__label">Turn</h3>
                <p>{howTo.turnStructure}</p>
              </section>
            ) : null}
            {howTo.specialRules ? (
              <section className="game-info__section">
                <h3 className="game-info__label">Special rules</h3>
                <p>{howTo.specialRules}</p>
              </section>
            ) : null}
            {howTo.winCondition ? (
              <section className="game-info__section">
                <h3 className="game-info__label">End</h3>
                <p>{howTo.winCondition}</p>
              </section>
            ) : null}
          </div>
        </details>
      ) : null}

      {showConfiguration ? (
        <div className="game-info__config section-stack">
          <h2 className="section-heading game-info__config-title">
            Configuration
          </h2>
          <div className="section-content">
            <p className="section-body game-info__config-value">
              {configuration.label}
            </p>
            {configuration.detail ? (
              <p className="section-status game-info__config-detail">
                {configuration.detail}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
