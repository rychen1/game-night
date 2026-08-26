/** Query parameter used in shareable room URLs (`/?code=XXXX`). */
export const ROOM_CODE_QUERY_PARAM = "code";

const ROOM_CODE_PATTERN = /^[A-Z0-9]{4}$/;

/** Normalize and validate a 4-character room code. */
export function normalizeRoomCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return ROOM_CODE_PATTERN.test(code) ? code : null;
}

/** Read a room code from `?code=XXXX` (or other search string). */
export function parseRoomCodeFromSearch(search: string): string | null {
  const query = search.startsWith("?") ? search.slice(1) : search;
  if (query.length === 0) {
    return null;
  }
  const raw = new URLSearchParams(query).get(ROOM_CODE_QUERY_PARAM);
  if (raw === null) {
    return null;
  }
  return normalizeRoomCode(raw);
}

/** Read a room code from `/join/XXXX` deep links. */
export function parseRoomCodeFromPath(pathname: string): string | null {
  const match = /^\/join\/([A-Za-z0-9]{4})\/?$/.exec(pathname);
  if (match?.[1] === undefined) {
    return null;
  }
  return normalizeRoomCode(match[1]);
}

/** Parse a share link location; query param takes precedence over path. */
export function parseRoomShareLocation(
  pathname: string,
  search: string,
): string | null {
  return (
    parseRoomCodeFromSearch(search) ?? parseRoomCodeFromPath(pathname)
  );
}

/** Build the canonical share URL for a room code on the given origin. */
export function buildRoomShareUrl(roomCode: string, origin: string): string {
  const code = normalizeRoomCode(roomCode);
  if (code === null) {
    throw new Error("Invalid room code");
  }
  const url = new URL(origin.endsWith("/") ? origin.slice(0, -1) : origin);
  url.pathname = "/";
  url.search = "";
  url.searchParams.set(ROOM_CODE_QUERY_PARAM, code);
  return url.toString();
}

/** Remove share parameters from the browser URL without reloading. */
export function clearRoomShareLocation(): void {
  if (typeof window === "undefined") {
    return;
  }
  const code = parseRoomShareLocation(
    window.location.pathname,
    window.location.search,
  );
  if (code === null) {
    return;
  }
  window.history.replaceState({}, "", `${window.location.origin}/`);
}
