import type { ReactNode } from "react";

export type TurnStatusActive = "you" | "other" | "idle" | "phase";

type TurnStatusProps = {
  /** e.g. "Your turn", "George's turn", "Drawing phase" */
  title: ReactNode;
  /** Supporting line under the title */
  detail?: ReactNode;
  active?: TurnStatusActive;
  /** Optional timer chip (e.g. PhaseTimer) */
  timer?: ReactNode;
  className?: string;
};

/**
 * Shared turn / phase status presentation.
 * Games supply copy; this standardizes hierarchy and highlight.
 */
export function TurnStatus({
  title,
  detail,
  active = "idle",
  timer,
  className,
}: TurnStatusProps) {
  return (
    <div
      className={["turn-status", className].filter(Boolean).join(" ")}
      data-active={active}
      role="status"
    >
      <div className="turn-status__main">
        <strong className="turn-status__title">{title}</strong>
        {detail ? <span className="turn-status__detail">{detail}</span> : null}
      </div>
      {timer ? <div className="turn-status__timer">{timer}</div> : null}
    </div>
  );
}
