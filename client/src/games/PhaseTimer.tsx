import { useEffect, useState } from "react";

type PhaseTimerProps = {
  /** Server-authoritative epoch ms; omit/null when phase is not timed. */
  endsAt: number | null | undefined;
  warningAtMsRemaining?: number;
  criticalAtMsRemaining?: number;
};

function formatCountdown(msRemaining: number): string {
  const totalSeconds = Math.max(0, Math.ceil(msRemaining / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Presentational countdown from a server deadline.
 * Never expires the phase — display refresh only.
 */
export function PhaseTimer({
  endsAt,
  warningAtMsRemaining = 10_000,
  criticalAtMsRemaining = 5_000,
}: PhaseTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt == null) {
      return;
    }
    setNow(Date.now());
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 250);
    return () => window.clearInterval(id);
  }, [endsAt]);

  if (endsAt == null) {
    return null;
  }

  const remaining = endsAt - now;
  const urgency =
    remaining <= criticalAtMsRemaining
      ? "critical"
      : remaining <= warningAtMsRemaining
        ? "warning"
        : "normal";

  const label = formatCountdown(remaining);

  return (
    <span
      className={`phase-timer phase-timer--${urgency}`}
      aria-live="polite"
      aria-label={`${label} remaining`}
    >
      {label}
    </span>
  );
}
