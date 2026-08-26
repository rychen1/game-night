import { useEffect, useState } from "react";
import type { LeftRoomReason } from "../network/messages.ts";
import type { ConnectionState } from "./ConnectionStatus.tsx";

type GlobalStatusBannerProps = {
  connectionState: ConnectionState;
  exitNotice?: LeftRoomReason | null;
};

type BannerKind = "connecting" | "lost" | "left" | "removed";

function resolveBannerKind(
  connectionState: ConnectionState,
  exitNotice: LeftRoomReason | null,
): BannerKind | null {
  if (connectionState === "connecting") {
    return "connecting";
  }
  if (connectionState === "lost") {
    return "lost";
  }
  if (exitNotice === "removed") {
    return "removed";
  }
  if (exitNotice === "left") {
    return "left";
  }
  return null;
}

/**
 * Application-shell status bar for room/connection state.
 * Renders above brand/page content — not a SectionPanel / tabletop card.
 * Dismiss is client presentation only and does not change server/room state.
 */
export function GlobalStatusBanner({
  connectionState,
  exitNotice = null,
}: GlobalStatusBannerProps) {
  const kind = resolveBannerKind(connectionState, exitNotice);
  const [dismissedKind, setDismissedKind] = useState<BannerKind | null>(null);

  useEffect(() => {
    if (kind === null) {
      setDismissedKind(null);
    }
  }, [kind]);

  if (kind === null || kind === dismissedKind) {
    return null;
  }

  const title =
    kind === "connecting"
      ? "Connecting…"
      : kind === "lost"
        ? "Connection lost"
        : kind === "removed"
          ? "You were removed from the room."
          : "You left the room.";
  const detail =
    kind === "removed" ? "The host removed you from this room." : null;

  return (
    <div
      className={[
        "global-status-banner",
        `global-status-banner--${kind}`,
      ].join(" ")}
      role="status"
      aria-live="polite"
    >
      <div className="global-status-banner__body">
        <p className="global-status-banner__title">{title}</p>
        {detail ? (
          <p className="global-status-banner__detail">{detail}</p>
        ) : null}
      </div>
      <button
        type="button"
        className="global-status-banner__dismiss"
        aria-label="Dismiss notification"
        title="Dismiss notification"
        onClick={() => setDismissedKind(kind)}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
