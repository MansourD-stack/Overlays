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
