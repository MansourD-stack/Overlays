import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Store, Streamer } from "./store";
import { sha256 } from "./util";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

export const SESSION_COOKIE = "jokko_session";
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"), expected.length);
  return timingSafeEqual(actual, expected);
}

/** Opaque random token in an HttpOnly cookie; only its SHA-256 is stored. */
export function createSession(store: Store, streamerId: string): { token: string; maxAgeSec: number } {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  store.data.sessions = store.data.sessions.filter((s) => s.expiresAt > now);
  store.data.sessions.push({ tokenHash: sha256(token), streamerId, expiresAt: now + SESSION_TTL_MS });
  store.save();
  return { token, maxAgeSec: SESSION_TTL_MS / 1000 };
}

export function streamerForSession(store: Store, token: string | undefined): Streamer | null {
  if (!token) return null;
  const hash = sha256(token);
  const session = store.data.sessions.find((s) => s.tokenHash === hash && s.expiresAt > Date.now());
  return session ? store.streamerById(session.streamerId) ?? null : null;
}

export function destroySession(store: Store, token: string | undefined) {
  if (!token) return;
  const hash = sha256(token);
  store.data.sessions = store.data.sessions.filter((s) => s.tokenHash !== hash);
  store.save();
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    try {
      out[key] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      /* ignore malformed cookie */
    }
  }
  return out;
}
