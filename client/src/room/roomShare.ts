/** Query parameter used in shareable room URLs (`/?code=XXXX`). */
export const ROOM_CODE_QUERY_PARAM = "code";

const ROOM_CODE_PATTERN = /^[A-Z0-9]{4}$/;

/** Normalize and validate a 4-character room code. */
export function normalizeRoomCode(raw: string): string | null {
  const code = raw.trim().toUpperCase();
  return ROOM_CODE_PATTERN.test(code) ? code : null;
}

/** Current page origin for share links (`protocol//host`). */
export function getRoomShareOrigin(): string {
  if (typeof window === "undefined") {
    return "http://localhost";
  }
  return window.location.origin;
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

/** Parse a full invitation URL (as encoded in QR codes and copied links). */
export function parseRoomShareUrl(href: string): string | null {
  try {
    const url = new URL(href);
    return parseRoomShareLocation(url.pathname, url.search);
  } catch {
    return null;
  }
}

/** Build the canonical share URL for a room code on the given origin. */
export function buildRoomShareUrl(roomCode: string, origin: string): string {
  const code = normalizeRoomCode(roomCode);
  if (code === null) {
    throw new Error("Invalid room code");
  }
  const base = origin.replace(/\/+$/, "");
  return `${base}/?${ROOM_CODE_QUERY_PARAM}=${code}`;
}

/** Alias used by tests and UI call sites. */
export const buildShareUrl = buildRoomShareUrl;

/** Value that must be passed to the QR encoder and clipboard copy. */
export function roomShareInvitationUrl(
  roomCode: string,
  origin: string = getRoomShareOrigin(),
): string | null {
  const code = normalizeRoomCode(roomCode);
  if (code === null) {
    return null;
  }
  return buildRoomShareUrl(code, origin);
}

/** Remove share parameters from the browser URL without reloading. */
export function clearRoomShareLocation(): void {
  if (typeof window === "undefined") {
    return;
  }
  const code = parseRoomShareUrl(window.location.href);
  if (code === null) {
    return;
  }
  window.history.replaceState({}, "", `${window.location.origin}/`);
}
