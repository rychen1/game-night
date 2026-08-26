import { normalizeRoomCode } from "./roomShare.ts";

/** Server errors that invalidate a reconnect attempt. */
export const RECONNECT_FAILURE_MESSAGES = [
  "Unknown reconnect token",
  "Room no longer exists",
] as const;

export type SessionStartupInput = {
  shareCode: string | null;
  reconnectToken: string | null;
  reconnectRoomCode: string | null;
};

export type SessionStartupDecision = {
  /** Send `reconnect` on WebSocket open. */
  shouldReconnect: boolean;
  /** Clear saved reconnect session before joining via share link. */
  discardReconnectSession: boolean;
};

/**
 * Decide whether to reconnect or defer to a share-link join on startup.
 *
 * An explicit share link for a different room takes precedence over a saved
 * reconnect session. A matching share link reuses reconnect to avoid duplicate
 * seats.
 */
export function resolveSessionStartup(
  input: SessionStartupInput,
): SessionStartupDecision {
  const { shareCode, reconnectToken, reconnectRoomCode } = input;

  if (!reconnectToken) {
    return { shouldReconnect: false, discardReconnectSession: false };
  }

  if (!shareCode) {
    return { shouldReconnect: true, discardReconnectSession: false };
  }

  if (reconnectRoomCode === null || reconnectRoomCode !== shareCode) {
    return { shouldReconnect: false, discardReconnectSession: true };
  }

  return { shouldReconnect: true, discardReconnectSession: false };
}

export function isReconnectFailureMessage(message: string): boolean {
  return (RECONNECT_FAILURE_MESSAGES as readonly string[]).includes(message);
}

/** Preserve share-link auto-join intent unless the user edits the room code away. */
export function pendingShareCodeAfterEdit(
  pendingShareCode: string | null,
  editedCode: string,
): string | null {
  if (pendingShareCode === null) {
    return null;
  }
  return normalizeRoomCode(editedCode) === pendingShareCode
    ? pendingShareCode
    : null;
}
