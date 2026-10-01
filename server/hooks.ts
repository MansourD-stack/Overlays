import { HttpError, randomId } from "./util";
import { cleanName, moderateMessage } from "./validation";

/**
 * Third-party integration events (Streamer.bot, TikFinity, Streamlabs
 * Desktop "webhook" actions…). They only drive overlay animations — a hook
 * can never create a donation: money only comes from verified payments.
 */
export const HOOK_TYPES = ["follow", "sub", "gift", "raid", "host", "victory", "defeat", "like_wave", "likes", "viewers", "message"] as const;
export type HookType = (typeof HOOK_TYPES)[number];

function int(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

/** Maps a loose tool payload (JSON body or query string) to bridge messages. */
export function hookMessages(input: Record<string, unknown>, blockedWords: string[] = []): unknown[] {
  const type = String(input.type ?? input.event ?? "").toLowerCase() as HookType;
  if (!(HOOK_TYPES as readonly string[]).includes(type)) {
    throw new HttpError(400, `type inconnu. Valeurs possibles : ${HOOK_TYPES.join(", ")}.`, "invalid_hook_type");
  }
  const username = cleanName(input.username ?? input.user ?? input.nickname);
  const event = (eventType: string, payload: Record<string, unknown>) => ({
    kind: "event",
    event: { id: randomId("hook", 8), type: eventType, payload, ts: Date.now() },
  });

  switch (type) {
    case "gift": {
      // TikTok tools usually send a coin value; map it onto the overlay's 3 intensity tiers.
      const coins = int(input.coins ?? input.diamonds, 0, 1_000_000, 0);
      const tier = input.tier !== undefined ? int(input.tier, 1, 3, 1) : coins >= 1000 ? 3 : coins >= 100 ? 2 : 1;
      return [event("gift", { username, giftName: moderateMessage(input.giftName ?? input.gift ?? "cadeau", blockedWords).slice(0, 32) || "cadeau", tier })];
    }
    case "raid":
    case "host":
      return [event(type, { username, viewers: int(input.viewers, 0, 1_000_000, 0) })];
    case "like_wave":
      return [event("custom", { kind: "like_wave" })];
    case "likes":
      return [{ kind: "config-patch", patch: { goals: { likes: { current: int(input.total ?? input.count, 0, 1_000_000_000, 0) } } } }];
    case "viewers":
      return [event("custom", { kind: "viewers", count: int(input.count ?? input.viewers, 0, 10_000_000, 0) })];
    case "message": {
      const text = moderateMessage(input.text ?? input.message, blockedWords);
      if (!text) throw new HttpError(400, "text requis pour type=message.", "missing_text");
      return [event("custom", { kind: "message", text })];
    }
    default:
      return [event(type, { username })];
  }
}

const CSV_HEADER = ["Date", "Référence", "Fan", "Rang", "Moyen", "Montant (F CFA)", "Commission", "Net", "Statut", "Message"];

/** Excel-friendly CSV (UTF-8 BOM, `;` separator) with formula-injection guard on every cell. */
export function toCsv(rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [CSV_HEADER, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}
