export type ConnectionState = "connected" | "connecting" | "lost";

type ConnectionStatusProps = {
  state: ConnectionState;
  /** When true, hide the quiet "Connected" chip (default). */
  hideWhenConnected?: boolean;
  className?: string;
};

/**
 * Connection state helpers. Visible Connecting… / Connection lost /
 * room-exit copy is rendered by `GlobalStatusBanner` at the app shell.
 */
export function ConnectionStatus({
  state,
  hideWhenConnected = true,
  className,
}: ConnectionStatusProps) {
  if (hideWhenConnected && state === "connected") {
    return null;
  }

  const text =
    state === "connected"
      ? "Connected"
      : state === "connecting"
        ? "Connecting…"
        : "Connection lost";

  return (
    <div
      className={[
        "global-status-banner",
        `global-status-banner--${state === "lost" ? "lost" : state === "connecting" ? "connecting" : "left"}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-live="polite"
    >
      <p className="global-status-banner__title">{text}</p>
    </div>
  );
}

export function connectionStateFromFlags(options: {
  connected: boolean;
  /** True before the first open, or while an intentional reconnect is in flight. */
  everOpened?: boolean;
}): ConnectionState {
  if (options.connected) {
    return "connected";
  }
  if (options.everOpened === false) {
    return "connecting";
  }
  return "lost";
}
