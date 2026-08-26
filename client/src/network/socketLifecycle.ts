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
