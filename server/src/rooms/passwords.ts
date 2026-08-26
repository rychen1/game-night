import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const MAX_PASSWORD_LENGTH = 64;

export function normalizePassword(password: string | undefined): string | null {
  if (typeof password !== "string") {
    return null;
  }
  if (password.length === 0 || password.length > MAX_PASSWORD_LENGTH) {
    return null;
  }
  return password;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const separator = stored.indexOf(":");
  if (separator <= 0) {
    return false;
  }
  const salt = stored.slice(0, separator);
  const hashHex = stored.slice(separator + 1);
  if (!salt || !hashHex) {
    return false;
  }
  let expected: Buffer;
  try {
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  const derived = scryptSync(password, salt, KEY_LENGTH);
  if (derived.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(derived, expected);
}
