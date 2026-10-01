/**
 * Browser-only Jokko demo (build:demo). Replaces `fetch("/api/…")` and the
 * realtime WebSocket with an in-browser imitation of the server, so every
 * page (dashboard, support page, overlays, /control, /admin) can be tried
 * without installing anything. Data lives in this browser's localStorage;
 * pages opened in other tabs stay in sync through BroadcastChannel.
 *
 * It mirrors server/app.ts on purpose and reuses its pure modules
 * (validation, ranks), but it is NOT the product: no real money, no real
 * security (passwords are stored as-is in the visitor's own browser).
 */
import { HttpError } from "../../server/errors";
import { RANKS, nextRank, rankFor } from "../../server/ranks";
import {
  METHOD_LABELS,
  PAYMENT_METHODS,
  cleanName,
  cleanText,
  isPaymentMethod,
  maskPhone,
  moderateMessage,
  normalizeSenegalPhone,
  parseAmount,
  validateEmail,
  validatePassword,
  validateSlug,
} from "../../server/validation";

const DB_KEY = "jokko-demo:v1";
const MIN = 200;
const MAX = 500_000;
const MIN_WITHDRAWAL = 1_000;
const COMMISSION = { free: 0.1, pro: 0.05 } as const;
const THEMES = ["dakar-neon", "flaas-fire", "atlantic-cyber", "tournament", "night-mode"];
export const DEMO_ADMIN_TOKEN = "demo-admin";

type Plan = "free" | "pro";
interface S {
  id: string;
  email: string;
  password: string;
  displayName: string;
  slug: string;
  plan: Plan;
  createdAt: number;
  overlayKey: string;
  hookKey: string;
  theme: string;
  communityName: string;
  page: { title: string; message: string; suggestedAmounts: number[] };
  goal: { label: string; target: number; since: number };
  showMessages: boolean;
  blockedWords: string[];
  payout: { method: "wave"; phone: string | null };
  overlayConfig?: Record<string, unknown>;
}
interface P {
  ref: string;
  streamerId: string;
  amount: number;
  method: string;
  fanName: string;
  fanMessage: string;
  fanKey: string | null;
  status: "pending" | "completed" | "failed" | "cancelled";
  commission: number;
  net: number;
  createdAt: number;
  completedAt: number | null;
}
interface W {
  id: string;
  streamerId: string;
  amount: number;
  phone: string;
  status: "pending" | "paid" | "rejected";
  createdAt: number;
  processedAt: number | null;
  note: string;
}
interface F {
  key: string;
  total: number;
  streamerIds: string[];
}
export interface DemoMail {
  to: string;
  subject: string;
  link: string;
  at: number;
}
interface DB {
  streamers: S[];
  session: string | null;
  payments: P[];
  withdrawals: W[];
  fans: F[];
  resets: { token: string; streamerId: string; expiresAt: number }[];
  mails: DemoMail[];
}

function rid(prefix: string, bytes = 9): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return `${prefix}_${btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}

/** Stand-in for the server's HMAC: links a fan's number across streamers without keeping it. */
function fanKey(phone: string): string {
  let h = 2166136261;
  for (const c of `jokko-demo:${phone}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return `test:${(h >>> 0).toString(16)}`;
}

function seed(): DB {
  const now = Date.now();
  const awa: S = {
    id: "str_demo_awa",
    email: "demo@jokko.sn",
    password: "demo1234",
    displayName: "Awa Gaming",
    slug: "awa-gaming",
    plan: "free",
    createdAt: now - 6 * 86400_000,
    overlayKey: "ovk_demo_awa",
    hookKey: "hk_demo_awa",
    theme: "dakar-neon",
    communityName: "Team Awa",
    page: { title: "Soutiens Awa Gaming", message: "Chaque soutien m'aide à streamer plus et mieux. Jërëjëf !", suggestedAmounts: [500, 1000, 2500, 5000] },
    goal: { label: "OBJECTIF DONS", target: 50_000, since: now - 6 * 86400_000 },
    showMessages: true,
    blockedWords: [],
    payout: { method: "wave", phone: null },
    overlayConfig: { game: "Free Fire" },
  };
  // Example history so the dashboard opens in a working state (all marked "(exemple)").
  const examples: [string, number, string, string][] = [
    ["Modou (exemple)", 2500, "wave", "Nio far ! Dama ready pour la ranked"],
    ["Khady (exemple)", 1000, "orange-money", "Bon stream !"],
    ["Ousmane (exemple)", 5000, "free-money", ""],
  ];
  const payments: P[] = examples.map(([fanName, amount, method, fanMessage], i) => {
    const commission = Math.round(amount * COMMISSION.free);
    const at = now - (i + 1) * 3 * 3600_000;
    return { ref: rid("jk"), streamerId: awa.id, amount, method, fanName, fanMessage, fanKey: null, status: "completed", commission, net: amount - commission, createdAt: at, completedAt: at };
  });
  return { streamers: [awa], session: awa.id, payments, withdrawals: [], fans: [], resets: [], mails: [] };
}

let memory: DB | null = null;
function load(): DB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) return (memory = JSON.parse(raw));
  } catch {
    /* storage blocked: keep an in-memory copy for this page */
  }
  if (!memory) {
    memory = seed();
    save(memory);
  }
  return memory;
}
function save(db: DB) {
  memory = db;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    /* in-memory only */
  }
}
export function resetDemo() {
  try {
    localStorage.removeItem(DB_KEY);
  } catch {
    /* ignore */
  }
  memory = null;
  load();
}
export function demoMails(): DemoMail[] {
  return load().mails;
}
export function demoStreamer(): { overlayKey: string; slug: string } {
  const db = load();
  const s = db.streamers.find((x) => x.id === db.session) ?? db.streamers[0];
  return { overlayKey: s.overlayKey, slug: s.slug };
}

const abs = (relative: string) => new URL(relative, location.href).href;
const supportRel = (slug: string) => `support.html?slug=${encodeURIComponent(slug)}`;

// ───────────────────────── realtime (WebSocket stand-in) ─────────────────────────

const sockets = new Set<FakeSocket>();
const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("jokko-demo") : null;
bc?.addEventListener("message", (e) => {
  const { channel, text } = e.data as { channel: string; text: string };
  for (const s of sockets) if (s.channel === channel) s.receive(text);
});

function publish(channel: string, message: unknown, except?: FakeSocket) {
  const text = JSON.stringify(message);
  for (const s of sockets) if (s !== except && s.channel === channel) s.receive(text);
  bc?.postMessage({ channel, text });
}

class FakeSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  readyState = 0;
  channel = "local";
  canSend = true;

  constructor(url: string) {
    super();
    const key = new URL(url, location.href).searchParams.get("key");
    const db = load();
    if (key) {
      const s = db.streamers.find((x) => x.overlayKey === key);
      this.channel = s ? s.id : "invalid";
      this.canSend = false;
    } else if (db.session) {
      this.channel = db.session;
    }
    sockets.add(this);
    setTimeout(() => {
      if (this.channel === "invalid") return this.close();
      this.readyState = 1;
      this.dispatchEvent(new Event("open"));
    }, 0);
  }
  receive(text: string) {
    if (this.readyState === 1) this.dispatchEvent(new MessageEvent("message", { data: text }));
  }
  send(text: string) {
    if (!this.canSend || this.readyState !== 1) return;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(text);
    } catch {
      return;
    }
    const next = this.channel === "local" ? msg : controllerFilter(this.channel, msg);
    if (next) publish(this.channel, next, this);
  }
  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    sockets.delete(this);
    this.dispatchEvent(new Event("close"));
  }
}

const SERVER_OWNED = ["pseudo", "communityName", "support", "lastSupporter", "theme"];
function withoutServerOwned(patch: Record<string, unknown>) {
  const out = { ...patch };
  for (const k of SERVER_OWNED) delete out[k];
  if (out.goals && typeof out.goals === "object") {
    const goals = { ...(out.goals as Record<string, unknown>) };
    delete goals.donations;
    out.goals = goals;
  }
  return out;
}
function merge(base: unknown, patch: unknown): unknown {
  if (typeof patch !== "object" || patch === null || Array.isArray(patch)) return patch === undefined ? base : patch;
  const out: Record<string, unknown> = typeof base === "object" && base !== null && !Array.isArray(base) ? { ...(base as object) } : {};
  for (const [k, v] of Object.entries(patch)) if (k !== "__proto__" && k !== "constructor") out[k] = merge(out[k], v);
  return out;
}
function themesFor(s: S) {
  return s.plan === "pro" ? THEMES : ["dakar-neon"];
}
function controllerFilter(channel: string, msg: Record<string, unknown>): Record<string, unknown> | null {
  const db = load();
  const s = db.streamers.find((x) => x.id === channel);
  if (!s) return null;
  const persist = (patch: Record<string, unknown>) => {
    s.overlayConfig = merge(s.overlayConfig ?? {}, withoutServerOwned(patch)) as Record<string, unknown>;
    save(db);
  };
  switch (msg.kind) {
    case "theme-change":
      if (!themesFor(s).includes(String(msg.theme))) return null;
      s.theme = String(msg.theme);
      save(db);
      return msg;
    case "config-patch":
      persist((msg.patch ?? {}) as Record<string, unknown>);
      return { kind: "config-patch", patch: withoutServerOwned((msg.patch ?? {}) as Record<string, unknown>) };
    case "performance-change":
      persist({ performanceProfile: msg.profile, reducedMotion: msg.reducedMotion });
      return msg;
    case "widget-toggle":
      if (typeof msg.widget === "string") persist({ widgets: { [msg.widget]: { enabled: msg.enabled === true } } });
      return msg;
    default:
      return msg;
  }
}

// ───────────────────────── API (fetch stand-in) ─────────────────────────

function goalProgress(db: DB, s: S) {
  return db.payments.filter((p) => p.streamerId === s.id && p.status === "completed" && (p.completedAt ?? 0) >= s.goal.since).reduce((n, p) => n + p.amount, 0);
}
function balance(db: DB, s: S) {
  const done = db.payments.filter((p) => p.streamerId === s.id && p.status === "completed");
  const received = done.reduce((n, p) => n + p.amount, 0);
  const net = done.reduce((n, p) => n + p.net, 0);
  const commission = done.reduce((n, p) => n + p.commission, 0);
  const own = db.withdrawals.filter((w) => w.streamerId === s.id);
  const withdrawn = own.filter((w) => w.status === "paid").reduce((n, w) => n + w.amount, 0);
  const pendingWithdrawals = own.filter((w) => w.status === "pending").reduce((n, w) => n + w.amount, 0);
  return { received, net, commission, count: done.length, withdrawn, pendingWithdrawals, available: net - withdrawn - pendingWithdrawals };
}
function overlayUrl(s: S, scene: string, layout: string) {
  return abs(`index.html?scene=${scene}&layout=${layout}&key=${s.overlayKey}`);
}
function overlayPatch(db: DB, s: S) {
  const cfg = s.overlayConfig ?? {};
  return {
    ...cfg,
    pseudo: s.displayName,
    communityName: s.communityName,
    support: { url: abs(supportRel(s.slug)) },
    goals: { ...((cfg.goals as object) ?? {}), donations: { current: goalProgress(db, s), target: s.goal.target, label: s.goal.label } },
  };
}
function publicStreamer(s: S) {
  const { password: _pw, ...rest } = s;
  return { ...rest, payout: { method: "wave", phone: s.payout.phone, masked: s.payout.phone ? maskPhone(s.payout.phone) : null } };
}
function announce(db: DB, s: S, p: Pick<P, "fanName" | "fanMessage" | "amount" | "method">, rank: { id: string; label: string } | null) {
  publish(s.id, {
    kind: "event",
    event: {
      id: rid("evt"),
      type: "donation",
      ts: Date.now(),
      payload: { username: p.fanName, amount: p.amount, currency: "XOF", method: p.method, methodLabel: METHOD_LABELS[p.method as keyof typeof METHOD_LABELS], message: s.showMessages ? p.fanMessage : "", rank, test: true },
    },
  });
  publish(s.id, { kind: "config-patch", patch: { goals: { donations: { current: goalProgress(db, s), target: s.goal.target, label: s.goal.label } }, lastSupporter: { name: p.fanName, type: "donation" } } });
}

type Req = { method: string; path: string; query: URLSearchParams; body: any; auth: string };

function me(db: DB): S {
  const s = db.streamers.find((x) => x.id === db.session);
  if (!s) throw new HttpError(401, "Connecte-toi pour continuer.", "unauthenticated");
  return s;
}

function route(r: Req): [number, unknown] {
  const db = load();
  const m = (re: RegExp) => re.exec(r.path);
  let x: RegExpExecArray | null;

  if (r.method === "GET" && (x = m(/^\/api\/public\/streamers\/([^/]+)$/))) {
    const s = db.streamers.find((y) => y.slug === decodeURIComponent(x![1]).toLowerCase());
    if (!s) throw new HttpError(404, "Ce streamer n'existe pas (encore) sur Jokko.", "not_found");
    return [200, { displayName: s.displayName, slug: s.slug, theme: s.theme, communityName: s.communityName, page: s.page, goal: { label: s.goal.label, target: s.goal.target, current: goalProgress(db, s) }, methods: PAYMENT_METHODS.map((id) => ({ id, label: METHOD_LABELS[id] })), minAmount: MIN, maxAmount: MAX, testMode: true, ranks: RANKS }];
  }
  if (r.method === "POST" && (x = m(/^\/api\/public\/streamers\/([^/]+)\/payments$/))) {
    const s = db.streamers.find((y) => y.slug === decodeURIComponent(x![1]).toLowerCase());
    if (!s) throw new HttpError(404, "Streamer introuvable.", "not_found");
    if (!isPaymentMethod(r.body.method)) throw new HttpError(400, "Choisis Wave, Orange Money ou Free Money.", "invalid_method");
    const amount = parseAmount(r.body.amount, MIN, MAX);
    let key: string | null = null;
    if (r.body.phone && String(r.body.phone).trim()) {
      const phone = normalizeSenegalPhone(String(r.body.phone));
      if (!phone) throw new HttpError(400, "Numéro sénégalais invalide (ex. 77 123 45 67).", "invalid_phone");
      key = fanKey(phone);
    }
    const commission = Math.round(amount * COMMISSION[s.plan]);
    const p: P = { ref: rid("jk", 12), streamerId: s.id, amount, method: r.body.method, fanName: cleanName(r.body.name), fanMessage: moderateMessage(r.body.message, s.blockedWords), fanKey: key, status: "pending", commission, net: amount - commission, createdAt: Date.now(), completedAt: null };
    db.payments.push(p);
    save(db);
    return [201, { ref: p.ref, redirectUrl: `pay-sim.html?ref=${encodeURIComponent(p.ref)}` }];
  }
  if (r.method === "GET" && (x = m(/^\/api\/public\/payments\/([^/]+)$/))) {
    const p = db.payments.find((y) => y.ref === decodeURIComponent(x![1]));
    if (!p) throw new HttpError(404, "Paiement introuvable.", "not_found");
    const s = db.streamers.find((y) => y.id === p.streamerId)!;
    const fan = p.status === "completed" && p.fanKey ? db.fans.find((f) => f.key === p.fanKey) : undefined;
    return [200, { ref: p.ref, status: p.status, amount: p.amount, method: p.method, methodLabel: METHOD_LABELS[p.method as keyof typeof METHOD_LABELS], fanName: p.fanName, streamer: { displayName: s.displayName, slug: s.slug }, fan: fan ? { rank: rankFor(fan.total), total: fan.total, streamers: fan.streamerIds.length, next: nextRank(fan.total) } : null, testMode: true }];
  }
  if ((x = m(/^\/api\/sim\/payments\/([^/]+)(\/confirm)?$/))) {
    const p = db.payments.find((y) => y.ref === decodeURIComponent(x![1]));
    if (!p) throw new HttpError(404, "Paiement introuvable.", "not_found");
    const s = db.streamers.find((y) => y.id === p.streamerId)!;
    if (r.method === "GET") return [200, { ref: p.ref, amount: p.amount, method: p.method, methodLabel: METHOD_LABELS[p.method as keyof typeof METHOD_LABELS], status: p.status, streamer: s.displayName, slug: s.slug }];
    const outcome = r.body.outcome === "failed" || r.body.outcome === "cancelled" ? r.body.outcome : "completed";
    if (p.status === "pending") {
      p.status = outcome;
      let rank: { id: string; label: string } | null = null;
      if (outcome === "completed") {
        p.completedAt = Date.now();
        if (p.fanKey) {
          let fan = db.fans.find((f) => f.key === p.fanKey);
          if (!fan) db.fans.push((fan = { key: p.fanKey, total: 0, streamerIds: [] }));
          fan.total += p.amount;
          if (!fan.streamerIds.includes(s.id)) fan.streamerIds.push(s.id);
          const rk = rankFor(fan.total);
          rank = { id: rk.id, label: rk.label };
        }
      }
      save(db);
      if (outcome === "completed") announce(db, s, p, rank);
    }
    return [200, { status: p.status, returnUrl: `${supportRel(s.slug)}&ref=${encodeURIComponent(p.ref)}${outcome === "cancelled" ? "&cancelled=1" : ""}` }];
  }
  if (r.method === "GET" && r.path === "/api/overlay/state") {
    const s = db.streamers.find((y) => y.overlayKey === r.query.get("key"));
    if (!s) throw new HttpError(404, "Clé d'overlay invalide.", "bad_key");
    return [200, { theme: s.theme, patch: overlayPatch(db, s) }];
  }

  // Accounts
  if (r.method === "POST" && r.path === "/api/auth/signup") {
    const email = validateEmail(r.body.email);
    const password = validatePassword(r.body.password);
    const slug = validateSlug(r.body.slug);
    const displayName = cleanText(r.body.displayName, 40);
    if (!displayName) throw new HttpError(400, "Choisis un nom de streamer.", "invalid_name");
    if (db.streamers.some((y) => y.email === email)) throw new HttpError(409, "Un compte existe déjà avec cet e-mail.", "email_taken");
    if (db.streamers.some((y) => y.slug === slug)) throw new HttpError(409, "Cet identifiant est déjà pris.", "slug_taken");
    const now = Date.now();
    const s: S = { id: rid("str"), email, password, displayName, slug, plan: "free", createdAt: now, overlayKey: rid("ovk", 12), hookKey: rid("hk", 12), theme: "dakar-neon", communityName: `Team ${displayName}`, page: { title: `Soutiens ${displayName}`, message: "Chaque soutien m'aide à streamer plus et mieux. Jërëjëf !", suggestedAmounts: [500, 1000, 2500, 5000] }, goal: { label: "OBJECTIF DONS", target: 50_000, since: now }, showMessages: true, blockedWords: [], payout: { method: "wave", phone: null } };
    db.streamers.push(s);
    db.session = s.id;
    save(db);
    return [201, { streamer: publicStreamer(s) }];
  }
  if (r.method === "POST" && r.path === "/api/auth/login") {
    const s = db.streamers.find((y) => y.email === String(r.body.email ?? "").trim().toLowerCase());
    if (!s || s.password !== String(r.body.password ?? "")) throw new HttpError(401, "E-mail ou mot de passe incorrect.", "bad_credentials");
    db.session = s.id;
    save(db);
    return [200, { streamer: publicStreamer(s) }];
  }
  if (r.method === "POST" && r.path === "/api/auth/logout") {
    db.session = null;
    save(db);
    return [200, { ok: true }];
  }
  if (r.method === "POST" && r.path === "/api/auth/forgot") {
    const s = db.streamers.find((y) => y.email === String(r.body.email ?? "").trim().toLowerCase());
    if (s) {
      const token = rid("rst", 18);
      db.resets = db.resets.filter((x2) => x2.streamerId !== s.id);
      db.resets.push({ token, streamerId: s.id, expiresAt: Date.now() + 30 * 60_000 });
      db.mails.unshift({ to: s.email, subject: "Jokko — réinitialise ton mot de passe", link: `dashboard.html?reset=${encodeURIComponent(token)}`, at: Date.now() });
      save(db);
    }
    return [200, { ok: true }];
  }
  if (r.method === "POST" && r.path === "/api/auth/reset") {
    const password = validatePassword(r.body.password);
    const reset = db.resets.find((x2) => x2.token === r.body.token && x2.expiresAt > Date.now());
    const s = reset ? db.streamers.find((y) => y.id === reset.streamerId) : undefined;
    if (!reset || !s) throw new HttpError(400, "Lien expiré ou déjà utilisé. Refais une demande.", "invalid_reset");
    s.password = password;
    db.resets = db.resets.filter((x2) => x2.streamerId !== s.id);
    db.session = s.id;
    save(db);
    return [200, { streamer: publicStreamer(s) }];
  }

  // Streamer dashboard
  if (r.method === "GET" && r.path === "/api/dashboard") {
    const s = me(db);
    const payments = db.payments
      .filter((p) => p.streamerId === s.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((p) => {
        const fan = p.fanKey ? db.fans.find((f) => f.key === p.fanKey) : undefined;
        return { ...p, methodLabel: METHOD_LABELS[p.method as keyof typeof METHOD_LABELS], rank: fan ? rankFor(fan.total).label : null };
      });
    const withdrawals = db.withdrawals.filter((w) => w.streamerId === s.id).sort((a, b) => b.createdAt - a.createdAt).map((w) => ({ ...w, phone: maskPhone(w.phone) }));
    return [200, {
      streamer: publicStreamer(s),
      balance: balance(db, s),
      goal: { label: s.goal.label, target: s.goal.target, current: goalProgress(db, s) },
      payments,
      withdrawals,
      overlay: { key: s.overlayKey, urls: { twitchGameplay: overlayUrl(s, "twitch-gameplay", "horizontal"), twitchStartingSoon: overlayUrl(s, "starting-soon", "horizontal"), twitchBrb: overlayUrl(s, "brb", "horizontal"), tiktokGameplay: overlayUrl(s, "tiktok-gameplay", "vertical"), tiktokStartingSoon: overlayUrl(s, "starting-soon", "vertical"), control: abs("control.html") } },
      hooks: { url: `https://<ton-serveur>/api/hooks/${s.hookKey}`, types: ["follow", "sub", "gift", "raid", "host", "victory", "defeat", "like_wave", "likes", "viewers", "message"] },
      supportUrl: abs(supportRel(s.slug)),
      themes: THEMES.map((id) => ({ id, available: themesFor(s).includes(id) })),
      commissionRate: COMMISSION[s.plan],
      limits: { minAmount: MIN, maxAmount: MAX, minWithdrawal: MIN_WITHDRAWAL },
      testMode: true,
      provider: "simulated",
    }];
  }
  if (r.method === "PATCH" && r.path === "/api/settings") {
    const s = me(db);
    const b = r.body;
    if (b.displayName !== undefined) s.displayName = cleanText(b.displayName, 40, s.displayName);
    if (b.communityName !== undefined) s.communityName = cleanText(b.communityName, 40, s.communityName);
    if (b.page) {
      if (b.page.title !== undefined) s.page.title = cleanText(b.page.title, 60, s.page.title);
      if (b.page.message !== undefined) s.page.message = cleanText(b.page.message, 280);
      if (Array.isArray(b.page.suggestedAmounts)) {
        const amounts = b.page.suggestedAmounts.slice(0, 4).map((a: unknown) => parseAmount(a, MIN, MAX));
        if (amounts.length) s.page.suggestedAmounts = amounts;
      }
    }
    if (b.goal) {
      if (b.goal.label !== undefined) s.goal.label = cleanText(b.goal.label, 30, s.goal.label);
      if (b.goal.target !== undefined) s.goal.target = parseAmount(b.goal.target, 1_000, 100_000_000);
      if (b.goal.reset === true) s.goal.since = Date.now();
    }
    if (b.theme !== undefined) {
      if (!THEMES.includes(b.theme)) throw new HttpError(400, "Thème inconnu.", "invalid_theme");
      if (!themesFor(s).includes(b.theme)) throw new HttpError(403, "Ce thème fait partie de l'offre Pro.", "plan_required");
      s.theme = b.theme;
      publish(s.id, { kind: "theme-change", theme: s.theme });
    }
    if (typeof b.showMessages === "boolean") s.showMessages = b.showMessages;
    if (Array.isArray(b.blockedWords)) s.blockedWords = b.blockedWords.slice(0, 50).map((w: unknown) => cleanText(w, 30)).filter(Boolean);
    save(db);
    publish(s.id, { kind: "config-patch", patch: overlayPatch(db, s) });
    return [200, { streamer: publicStreamer(s) }];
  }
  if (r.method === "PUT" && r.path === "/api/payout") {
    const s = me(db);
    const phone = normalizeSenegalPhone(String(r.body.phone ?? ""));
    if (!phone) throw new HttpError(400, "Numéro Wave invalide (ex. 77 123 45 67).", "invalid_phone");
    s.payout = { method: "wave", phone };
    save(db);
    return [200, { streamer: publicStreamer(s) }];
  }
  if (r.method === "POST" && r.path === "/api/withdrawals") {
    const s = me(db);
    if (!s.payout.phone) throw new HttpError(400, "Connecte d'abord ton numéro Wave pour recevoir tes retraits.", "no_payout");
    const { available } = balance(db, s);
    const amount = parseAmount(r.body.amount, MIN_WITHDRAWAL, Number.MAX_SAFE_INTEGER);
    if (amount > available) throw new HttpError(400, `Solde insuffisant (disponible : ${available} F CFA).`, "insufficient_balance");
    const w: W = { id: rid("wd"), streamerId: s.id, amount, phone: s.payout.phone, status: "pending", createdAt: Date.now(), processedAt: null, note: "" };
    db.withdrawals.push(w);
    save(db);
    return [201, { withdrawal: { id: w.id, amount, status: w.status }, balance: balance(db, s) }];
  }
  if (r.method === "POST" && r.path === "/api/overlay/rotate-key") {
    const s = me(db);
    s.overlayKey = rid("ovk", 12);
    save(db);
    return [200, { overlay: { key: s.overlayKey } }];
  }
  if (r.method === "POST" && r.path === "/api/hooks/rotate") {
    const s = me(db);
    s.hookKey = rid("hk", 12);
    save(db);
    return [200, { hooks: { url: `https://<ton-serveur>/api/hooks/${s.hookKey}` } }];
  }
  if (r.method === "POST" && r.path === "/api/overlay/test-alert") {
    const s = me(db);
    const names = ["Awa", "Modou", "Fatou", "Ibrahima", "Khady", "Cheikh", "Astou", "Ousmane"];
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    const rank = pick(RANKS);
    announce(db, s, { fanName: pick(names), fanMessage: cleanText(r.body.message, 140) || "Test d'alerte Jokko — on est ensemble !", amount: Number.isInteger(r.body.amount) ? r.body.amount : pick([500, 1000, 2500, 5000, 15000]), method: pick(PAYMENT_METHODS) }, { id: rank.id, label: rank.label });
    return [200, { ok: true }];
  }

  // Admin
  if (r.path.startsWith("/api/admin/")) {
    if (r.auth !== `Bearer ${DEMO_ADMIN_TOKEN}`) throw new HttpError(401, `Accès administrateur refusé. Dans la démo, le jeton est « ${DEMO_ADMIN_TOKEN} ».`, "admin_only");
    if (r.method === "GET" && r.path === "/api/admin/stats") {
      const done = db.payments.filter((p) => p.status === "completed");
      const pending = db.withdrawals.filter((w) => w.status === "pending");
      return [200, { livemode: false, provider: "simulated", streamers: db.streamers.length, pro: db.streamers.filter((s) => s.plan === "pro").length, payments: done.length, volume: done.reduce((n, p) => n + p.amount, 0), commission: done.reduce((n, p) => n + p.commission, 0), fans: db.fans.length, pendingWithdrawals: { count: pending.length, amount: pending.reduce((n, w) => n + w.amount, 0) } }];
    }
    if (r.method === "GET" && r.path === "/api/admin/streamers") {
      return [200, { streamers: db.streamers.map((s) => ({ id: s.id, slug: s.slug, displayName: s.displayName, email: s.email, plan: s.plan, createdAt: s.createdAt, received: balance(db, s).received, available: balance(db, s).available, payout: s.payout.phone })) }];
    }
    if (r.method === "GET" && r.path === "/api/admin/withdrawals") {
      const status = r.query.get("status");
      return [200, { withdrawals: db.withdrawals.filter((w) => !status || w.status === status).map((w) => ({ ...w, streamer: db.streamers.find((s) => s.id === w.streamerId)?.slug ?? null })) }];
    }
    if (r.method === "POST" && (x = m(/^\/api\/admin\/withdrawals\/([^/]+)$/))) {
      const w = db.withdrawals.find((y) => y.id === decodeURIComponent(x![1]));
      if (!w) throw new HttpError(404, "Retrait introuvable.", "not_found");
      if (w.status !== "pending") throw new HttpError(409, "Ce retrait a déjà été traité.", "already_processed");
      if (r.body.status !== "paid" && r.body.status !== "rejected") throw new HttpError(400, "status doit valoir paid ou rejected.");
      w.status = r.body.status;
      w.processedAt = Date.now();
      w.note = cleanText(r.body.note, 200);
      save(db);
      return [200, { withdrawal: w }];
    }
    if (r.method === "POST" && (x = m(/^\/api\/admin\/streamers\/([^/]+)\/plan$/))) {
      const s = db.streamers.find((y) => y.slug === decodeURIComponent(x![1]));
      if (!s) throw new HttpError(404, "Streamer introuvable.", "not_found");
      if (r.body.plan !== "free" && r.body.plan !== "pro") throw new HttpError(400, "plan doit valoir free ou pro.");
      s.plan = r.body.plan;
      if (!themesFor(s).includes(s.theme)) s.theme = "dakar-neon";
      save(db);
      return [200, { streamer: publicStreamer(s) }];
    }
  }
  throw new HttpError(404, "Cette fonction n'existe pas dans la démo.", "not_found");
}

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url, location.href);
  const apiAt = url.pathname.indexOf("/api/");
  if (apiAt < 0) return realFetch(input, init);
  const headers = new Headers(init?.headers);
  let body: any = {};
  try {
    body = init?.body ? JSON.parse(String(init.body)) : {};
  } catch {
    body = {};
  }
  try {
    const [status, json] = route({ method: (init?.method ?? "GET").toUpperCase(), path: url.pathname.slice(apiAt), query: url.searchParams, body, auth: headers.get("Authorization") ?? "" });
    return new Response(JSON.stringify(json), { status, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    const e = err instanceof HttpError ? err : new HttpError(500, "Erreur inattendue dans la démo.", "internal");
    if (!(err instanceof HttpError)) console.error(err);
    return new Response(JSON.stringify({ error: e.message, code: e.code }), { status: e.status, headers: { "Content-Type": "application/json" } });
  }
};
(window as unknown as { WebSocket: unknown }).WebSocket = FakeSocket;

// Overlay pages are transparent for OBS; in the demo they get a backdrop instead of the host page's.
if (document.getElementById("app")) {
  const style = document.createElement("style");
  style.textContent = "html,body{background:#03050a}";
  document.head.appendChild(style);
}

// "← Démo" pill on every page, except inside the demo home page's live previews
// (frameElement is only readable from a same-origin parent, i.e. the hub).
let inHubPreview = false;
try {
  inHubPreview = !!window.frameElement?.hasAttribute("data-src");
} catch {
  inHubPreview = false;
}
if (!inHubPreview) {
  const addPill = () => {
    const a = document.createElement("a");
    let hub = "../";
    try {
      hub = sessionStorage.getItem("jokko-demo:hub") || hub; // set by the demo home page
    } catch {
      /* storage blocked */
    }
    a.href = hub;
    a.textContent = "← Démo Jokko";
    a.setAttribute("style", "position:fixed;right:12px;bottom:12px;z-index:2147483647;padding:8px 14px;border-radius:999px;background:#ffc94d;color:#120f2b;font:700 13px system-ui,sans-serif;text-decoration:none;box-shadow:0 4px 16px rgba(0,0,0,.35)");
    document.body.appendChild(a);
  };
  if (document.body) addPill();
  else document.addEventListener("DOMContentLoaded", addPill);
}
