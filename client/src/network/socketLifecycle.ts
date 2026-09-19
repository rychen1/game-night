/** Application ping interval while the socket is OPEN. */
export const PING_INTERVAL_MS = 20_000;

const RECONNECT_BACKOFF_MS = [500, 1_000, 2_000, 5_000] as const;

/** Delay before the next replace-on-close attempt. `failedAttempts` is 0 after the first drop. */
export function nextReconnectDelayMs(failedAttempts: number): number {
  const last = RECONNECT_BACKOFF_MS.length - 1;
  const index = Math.min(Math.max(failedAttempts, 0), last);
  return RECONNECT_BACKOFF_MS[index]!;
}

/** Unexpected close should open a replacement socket. Unmount `close()` should not. */
export function shouldScheduleReconnect(closedByClient: boolean): boolean {
  return !closedByClient;
}

/**
 * Resume immediately when the tab becomes visible or the network returns,
 * unless a socket is already OPEN or CONNECTING.
 */
export function shouldAttemptImmediateReconnect(options: {
  closedByClient: boolean;
  readyState: number;
  connecting: number;
  open: number;
}): boolean {
  if (options.closedByClient) {
    return false;
  }
  return (
    options.readyState !== options.connecting &&
    options.readyState !== options.open
  );
}

/** Monotonic id assigned to each new socket connection attempt. */
let nextGeneration = 0;

export type ConnectionGeneration = {
  isActive: () => boolean;
};

/** Create a generation token for one `connectSocket()` call. */
export function createConnectionGeneration(): ConnectionGeneration {
  const generation = ++nextGeneration;
  return {
    isActive: () => generation === nextGeneration,
  };
}

/** Invoke a lifecycle callback only when its generation is still current. */
export function invokeLifecycleCallback(
  connection: ConnectionGeneration,
  callback: () => void,
): boolean {
  if (!connection.isActive()) {
    return false;
  }
  callback();
  return true;
}

/** Test-only reset of the generation counter. */
export function resetConnectionGenerationsForTests(): void {
  nextGeneration = 0;
}
