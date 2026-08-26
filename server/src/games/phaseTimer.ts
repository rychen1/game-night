/** Epoch-ms deadline `durationMs` from now. */
export function deadlineFromNow(durationMs: number): number {
  return Date.now() + durationMs;
}
