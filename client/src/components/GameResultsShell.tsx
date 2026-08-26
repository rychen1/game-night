import type { ReactNode } from "react";

export type GameScoreRow = {
  id: string;
  name: string;
  value: string | number;
  highlight?: boolean;
};

type GameResultsShellProps = {
  /** e.g. "Game complete" or "Mission complete" */
  heading: string;
  /** Primary outcome line(s) under the heading */
  outcome?: ReactNode;
  /** Optional numeric/label scoreboard; omit when the game has no scores */
  scores?: GameScoreRow[];
  scoresHeading?: string;
  /** Heading above game-specific review content */
  reviewHeading?: string;
  /** Game-specific review / retrospective body */
  children?: ReactNode;
  /** Play Again / Return to Lobby (and ready-check) */
  footer?: ReactNode;
  className?: string;
};

/**
 * Shared end-of-game results hierarchy.
 * Unify presentation; scoring rules stay game-owned.
 */
export function GameResultsShell({
  heading,
  outcome,
  scores,
  scoresHeading = "Scores",
  reviewHeading = "Review",
  children,
  footer,
  className,
}: GameResultsShellProps) {
  const hasScores = scores !== undefined && scores.length > 0;
  const hasReview = children != null && children !== false;

  return (
    <section
      className={["game-results", className].filter(Boolean).join(" ")}
    >
      <h2 className="game-results__heading">{heading}</h2>
      {outcome ? (
        <div className="game-results__outcome">{outcome}</div>
      ) : null}

      {hasScores ? (
        <div className="game-results__scores">
          <h3 className="game-results__section-title">{scoresHeading}</h3>
          <ul className="game-results__score-list">
            {scores.map((row) => (
              <li
                key={row.id}
                className={[
                  "game-results__score-row",
                  row.highlight ? "is-highlight" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="game-results__score-name">{row.name}</span>
                <span className="game-results__score-value">{row.value}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasReview ? (
        <div className="game-results__review">
          <h3 className="game-results__section-title">{reviewHeading}</h3>
          <div className="game-results__review-body">{children}</div>
        </div>
      ) : null}

      {footer ? <div className="game-results__footer">{footer}</div> : null}
    </section>
  );
}
