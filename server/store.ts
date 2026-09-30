import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Plan } from "./config";

export type PaymentMethod = "wave" | "orange-money" | "free-money";
export type PaymentStatus = "pending" | "completed" | "failed" | "cancelled";
export type WithdrawalStatus = "pending" | "paid" | "rejected";

export interface Streamer {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  slug: string;
  plan: Plan;
  createdAt: number;
  /** Read-only key embedded in the OBS / TikTok LIVE Studio Browser Source URL. */
  overlayKey: string;
  theme: string;
  communityName: string;
  page: { title: string; message: string; suggestedAmounts: number[] };
  goal: { label: string; target: number; since: number };
  /** Fan messages are shown on stream only when enabled, after moderation. */
  showMessages: boolean;
  blockedWords: string[];
  /** "Connexion à un compte Wave" = the Wave number payouts are sent to. */
  payout: { method: "wave"; phone: string | null };
}

export interface Session {
  tokenHash: string;
  streamerId: string;
  expiresAt: number;
}

export interface Payment {
  id: string;
  ref: string;
  streamerId: string;
  amount: number;
  currency: "XOF";
  method: PaymentMethod;
  fanName: string;
  fanMessage: string;
  /** HMAC of the fan's phone number — links a fan across streamers without storing the number. */
  fanKey: string | null;
  status: PaymentStatus;
  provider: string;
  providerToken: string | null;
  livemode: boolean;
  commission: number;
  net: number;
  createdAt: number;
  completedAt: number | null;
  lastCheckAt: number;
}

export interface Withdrawal {
  id: string;
  streamerId: string;
  amount: number;
  phone: string;
  method: "wave";
  status: WithdrawalStatus;
  livemode: boolean;
  createdAt: number;
  processedAt: number | null;
  note: string;
}

export interface Fan {
  /** `${live|test}:${hmac}` — test and live ranks never mix. */
  key: string;
  total: number;
  donations: number;
  streamerIds: string[];
  lastName: string;
  createdAt: number;
}

export interface Snapshot {
  version: 1;
  streamers: Streamer[];
  sessions: Session[];
  payments: Payment[];
  withdrawals: Withdrawal[];
  fans: Fan[];
}

const EMPTY: Snapshot = { version: 1, streamers: [], sessions: [], payments: [], withdrawals: [], fans: [] };

/**
 * Minimal persistent store: the whole dataset lives in memory and is written
 * atomically (tmp file + rename) to `data/jokko.json` shortly after each
 * change. It is deliberately dependency-free so the MVP installs in minutes;
 * every access goes through this class, so swapping it for PostgreSQL/SQLite
 * later only touches this file. Single-process only.
 */
export class Store {
  readonly data: Snapshot;
  private file: string | null;
  private timer: NodeJS.Timeout | null = null;

  constructor(dataDir: string | null) {
    this.file = dataDir ? join(dataDir, "jokko.json") : null;
    this.data = structuredClone(EMPTY);
    if (this.file && existsSync(this.file)) {
      const parsed = JSON.parse(readFileSync(this.file, "utf8")) as Partial<Snapshot>;
      Object.assign(this.data, EMPTY, parsed);
    }
  }

  /** Schedules a write; call after any mutation. */
  save() {
    if (!this.file || this.timer) return;
    this.timer = setTimeout(() => this.flush(), 50);
  }

  flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.file) return;
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(this.data), { mode: 0o600 });
    renameSync(tmp, this.file);
  }

  streamerById(id: string) {
    return this.data.streamers.find((s) => s.id === id);
  }
  streamerBySlug(slug: string) {
    return this.data.streamers.find((s) => s.slug === slug);
  }
  streamerByEmail(email: string) {
    return this.data.streamers.find((s) => s.email === email);
  }
  streamerByOverlayKey(key: string) {
    return this.data.streamers.find((s) => s.overlayKey === key);
  }
  paymentByRef(ref: string) {
    return this.data.payments.find((p) => p.ref === ref);
  }
  paymentByProviderToken(provider: string, token: string) {
    return this.data.payments.find((p) => p.provider === provider && p.providerToken === token);
  }
  fan(key: string) {
    return this.data.fans.find((f) => f.key === key);
  }
}
