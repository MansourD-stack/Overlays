import type { IncomingMessage, ServerResponse } from "node:http";
import { HttpError } from "./util";

export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  params: Record<string, string>;
  ip: string;
}

export type Handler = (ctx: Ctx) => Promise<void> | void;

const MAX_BODY = 64 * 1024;

/** Turns `data[invoice][token]=x` style keys (PayDunya IPN) into nested objects. */
export function parseForm(text: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [rawKey, value] of new URLSearchParams(text)) {
    const parts = rawKey.split(/\[|\]\[|\]/).filter((p) => p !== "");
    if (parts.some((p) => p === "__proto__" || p === "constructor" || p === "prototype")) continue;
    let node = out as Record<string, unknown>;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) node[part] = value;
      else {
        if (typeof node[part] !== "object" || node[part] === null) node[part] = {};
        node = node[part] as Record<string, unknown>;
      }
    });
  }
  return out;
}

export async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, "Requête trop volumineuse.");
    chunks.push(chunk as Buffer);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  const type = req.headers["content-type"] ?? "";
  if (type.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      throw new HttpError(400, "JSON invalide.");
    }
  }
  if (type.includes("application/x-www-form-urlencoded")) return parseForm(text);
  throw new HttpError(415, "Type de contenu non supporté.");
}

export function sendJson(res: ServerResponse, status: number, data: unknown, headers: Record<string, string | string[]> = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(data));
}

interface Route {
  method: string;
  regex: RegExp;
  keys: string[];
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  constructor(private trustProxy = false) {}

  private clientIp(req: IncomingMessage): string {
    if (this.trustProxy) {
      const fwd = req.headers["x-forwarded-for"];
      const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim();
      if (first) return first;
    }
    return req.socket.remoteAddress ?? "unknown";
  }

  add(method: string, pattern: string, handler: Handler) {
    const keys: string[] = [];
    const regex = new RegExp(
      "^" +
        pattern.replace(/\/:([a-zA-Z]+)/g, (_m, key: string) => {
          keys.push(key);
          return "/([^/]+)";
        }) +
        "$"
    );
    this.routes.push({ method, regex, keys, handler });
  }

  /** Resolves true when a route matched (and responded). */
  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? "/", "http://localhost");
    let pathMatched = false;
    for (const route of this.routes) {
      const m = route.regex.exec(url.pathname);
      if (!m) continue;
      pathMatched = true;
      if (route.method !== req.method) continue;
      const params: Record<string, string> = {};
      route.keys.forEach((k, i) => {
        try {
          params[k] = decodeURIComponent(m[i + 1]);
        } catch {
          params[k] = m[i + 1];
        }
      });
      const ip = this.clientIp(req);
      try {
        await route.handler({ req, res, url, params, ip });
      } catch (err) {
        if (err instanceof HttpError) sendJson(res, err.status, { error: err.message, code: err.code });
        else {
          console.error("[jokko]", err);
          sendJson(res, 500, { error: "Erreur interne. Réessaie dans un instant.", code: "internal" });
        }
      }
      return true;
    }
    if (pathMatched) {
      sendJson(res, 405, { error: "Méthode non autorisée.", code: "method_not_allowed" });
      return true;
    }
    return false;
  }
}

/** Fixed-window in-memory rate limiter (per key, e.g. IP + route). */
export class RateLimiter {
  private hits = new Map<string, { count: number; reset: number }>();
  constructor(
    private limit: number,
    private windowMs: number
  ) {}

  check(key: string) {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || entry.reset < now) {
      this.hits.set(key, { count: 1, reset: now + this.windowMs });
      if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (v.reset < now) this.hits.delete(k);
      return;
    }
    entry.count += 1;
    if (entry.count > this.limit) throw new HttpError(429, "Trop de tentatives. Patiente une minute.", "rate_limited");
  }
}
