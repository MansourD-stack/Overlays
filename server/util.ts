import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export function randomId(prefix: string, bytes = 12): string {
  return `${prefix}_${randomBytes(bytes).toString("base64url")}`;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmac(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code = "error"
  ) {
    super(message);
  }
}

const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Plain-object deep merge (arrays and scalars replace). Ignores prototype-polluting keys. */
export function deepMerge(base: unknown, patch: unknown): unknown {
  if (typeof patch !== "object" || patch === null || Array.isArray(patch)) return patch === undefined ? base : patch;
  const out: Record<string, unknown> = typeof base === "object" && base !== null && !Array.isArray(base) ? { ...(base as Record<string, unknown>) } : {};
  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (UNSAFE_KEYS.has(key)) continue;
    out[key] = deepMerge(out[key], value);
  }
  return out;
}
