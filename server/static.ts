import { createReadStream, existsSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { PROTECTED_PAGES, pageFor } from "./app";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

/** Serves the Vite build (dist/) with the same clean URLs as the dev server. */
export function serveStatic(root: string, req: IncomingMessage, res: ServerResponse) {
  const base = resolve(root);
  let pathname = "/";
  try {
    pathname = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  const page = pageFor(pathname);
  const rel = page ?? (pathname === "/" ? "index.html" : pathname.slice(1));
  const file = resolve(base, normalize(rel));
  if (file !== base && !file.startsWith(base + sep)) {
    res.writeHead(403).end();
    return;
  }
  const target = existsSync(file) && statSync(file).isFile() ? file : null;
  if (!target) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Introuvable");
    return;
  }
  const headers: Record<string, string> = {
    "Content-Type": MIME[extname(target)] ?? "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cache-Control": target.includes(`${sep}assets${sep}`) && /-[\w-]{8}\.(js|css)$/.test(target) ? "public, max-age=31536000, immutable" : "no-cache",
  };
  if (page && PROTECTED_PAGES.has(page)) headers["X-Frame-Options"] = "DENY";
  res.writeHead(200, headers);
  if (req.method === "HEAD") return void res.end();
  createReadStream(target).pipe(res);
}

export function distDir(root: string) {
  return join(root, "dist");
}
