import type { ReactNode } from "react";

type GameActionAreaProps = {
  /** Optional section label, e.g. "Your action" */
  label?: string;
  children: ReactNode;
  className?: string;
};

/**
 * Shared primary-action region under game content.
 * Controls remain game-owned; this standardizes placement and hierarchy.
 */
export function GameActionArea({
  label = "Your action",
  children,
  className,
}: GameActionAreaProps) {
  return (
    <div
      className={["game-action-area", className].filter(Boolean).join(" ")}
    >
      {label ? (
        <h3 className="game-action-area__label">{label}</h3>
      ) : null}
      <div className="game-action-area__controls">{children}</div>
    </div>
  );
}
