import type { IncomingMessage, ServerResponse } from "node:http";
import type { JokkoConfig } from "./config";
import { Store, type Streamer } from "./store";
import { RealtimeHub } from "./realtime";
import { Router, RateLimiter, readBody, sendJson, type Ctx } from "./http";
import { SESSION_COOKIE, createSession, destroySession, hashPassword, parseCookies, streamerForSession, verifyPassword } from "./auth";
import { PaymentService } from "./payments/service";
import { SimulatedProvider } from "./payments/simulated";
import { PayDunyaProvider } from "./payments/paydunya";
import { CinetPayProvider } from "./payments/cinetpay";
import type { PaymentProvider } from "./payments/provider";
import { ConsoleMailer, ResendMailer, type Mailer } from "./mailer";
import { RANKS, nextRank, rankFor } from "./ranks";
import { HOOK_TYPES, hookMessages, toCsv } from "./hooks";
import { HttpError, deepMerge, randomId, safeEqual, sha256 } from "./util";
import {
  METHOD_LABELS,
  PAYMENT_METHODS,
  cleanText,
  isPaymentMethod,
  maskPhone,
  normalizeSenegalPhone,
  parseAmount,
  validateEmail,
  validatePassword,
  validateSlug,
} from "./validation";

/** Kept in sync with src/themes/index.ts (the server can't import CSS-bearing modules). */
export const THEMES = ["dakar-neon", "flaas-fire", "atlantic-cyber", "tournament", "night-mode"] as const;
const FREE_THEMES = ["dakar-neon"];

/** Clean URLs → Vite HTML entries. Shared by the dev middleware and the production static server. */
export function pageFor(pathname: string): string | null {
  if (pathname === "/control" || pathname === "/control/") return "control.html";
  if (pathname === "/dashboard" || pathname === "/dashboard/") return "dashboard.html";
  if (pathname === "/admin" || pathname === "/admin/") return "admin.html";
  if (/^\/s\/[^/]+\/?$/.test(pathname)) return "support.html";
  if (/^\/pay\/sim\/[^/]+\/?$/.test(pathname)) return "pay-sim.html";
  return null;
}

/** Pages that handle money or accounts must never be framed by another site. */
export const PROTECTED_PAGES = new Set(["dashboard.html", "support.html", "pay-sim.html", "admin.html"]);

export interface JokkoApp {
  store: Store;
  hub: RealtimeHub;
  payments: PaymentService;
  provider: PaymentProvider;
  mailer: Mailer;
  /** Handles /api/*; resolves true when it responded. */
  handle(req: IncomingMessage, res: ServerResponse): Promise<boolean>;
  close(): void;
}

export function createProvider(cfg: JokkoConfig): PaymentProvider {
  if (cfg.provider === "paydunya" && cfg.paydunya) return new PayDunyaProvider(cfg.paydunya);
  if (cfg.provider === "cinetpay" && cfg.cinetpay) return new CinetPayProvider(cfg.cinetpay);
  return new SimulatedProvider(cfg.secret);
}

export function createJokkoApp(cfg: JokkoConfig, opts: { store?: Store; provider?: PaymentProvider; mailer?: Mailer } = {}): JokkoApp {
  const store = opts.store ?? new Store(cfg.dataDir);
  const mailer = opts.mailer ?? (cfg.mail ? new ResendMailer(cfg.mail.resendApiKey, cfg.mail.from) : new ConsoleMailer());
  const hub = new RealtimeHub(store, cfg.allowLocalBridge);
  const provider = opts.provider ?? createProvider(cfg);
  const payments = new PaymentService(store, provider, cfg, hub);
  const router = new Router(cfg.trustProxy);

  // Automatic backups: shortly after start-up, then daily (no-op for in-memory stores).
  const runBackup = () => {
    try {
      store.backup();
    } catch (err) {
      console.error("[jokko] sauvegarde impossible :", err);
    }
  };
  const firstBackup = setTimeout(runBackup, 5_000);
  const dailyBackup = setInterval(runBackup, 24 * 3600_000);
  firstBackup.unref();
  dailyBackup.unref();

  const limits = {
    pay: new RateLimiter(10, 60_000),
    auth: new RateLimiter(10, 5 * 60_000),
    signup: new RateLimiter(5, 10 * 60_000),
    status: new RateLimiter(120, 60_000),
    hooks: new RateLimiter(60, 10_000),
    forgot: new RateLimiter(5, 15 * 60_000),
  };

  const baseUrl = (req: IncomingMessage) => cfg.publicUrl ?? `http://${req.headers.host ?? "localhost"}`;

  function secureCookie() {
    return cfg.publicUrl?.startsWith("https://") ? "; Secure" : "";
  }

  /** CSRF guard for cookie-authenticated writes: JSON-only bodies + same-origin check. */
  function assertSameOrigin(req: IncomingMessage) {
    const origin = req.headers.origin;
    if (origin) {
      let host = "";
      try {
        host = new URL(origin).host;
      } catch {
        /* invalid origin */
      }
      if (host !== req.headers.host) throw new HttpError(403, "Origine refusée.", "bad_origin");
    }
    if (!(req.headers["content-type"] ?? "").includes("application/json")) throw new HttpError(415, "JSON attendu.", "json_required");
  }

  function auth(ctx: Ctx, write = false): Streamer {
    if (write) assertSameOrigin(ctx.req);
    const streamer = streamerForSession(store, parseCookies(ctx.req.headers.cookie)[SESSION_COOKIE]);
    if (!streamer) throw new HttpError(401, "Connecte-toi pour continuer.", "unauthenticated");
    return streamer;
  }

  function admin(ctx: Ctx) {
    const header = ctx.req.headers.authorization ?? "";
    if (!cfg.adminToken || !header.startsWith("Bearer ") || !safeEqual(header.slice(7), cfg.adminToken)) {
      throw new HttpError(401, "Accès administrateur refusé.", "admin_only");
    }
  }

  function themesFor(streamer: Streamer): string[] {
    return streamer.plan === "pro" ? [...THEMES] : FREE_THEMES;
  }

  function overlayUrls(req: IncomingMessage, streamer: Streamer) {
    const base = baseUrl(req);
    const url = (scene: string, layout: string) => `${base}/?scene=${scene}&layout=${layout}&key=${streamer.overlayKey}`;
    return {
      twitchGameplay: url("twitch-gameplay", "horizontal"),
      twitchStartingSoon: url("starting-soon", "horizontal"),
      twitchBrb: url("brb", "horizontal"),
      tiktokGameplay: url("tiktok-gameplay", "vertical"),
      tiktokStartingSoon: url("starting-soon", "vertical"),
      control: `${base}/control`,
    };
  }

  /** Fields the server owns: never taken from /control, always win over saved overlay settings. */
  const SERVER_OWNED = ["pseudo", "communityName", "support", "lastSupporter", "theme"];
  const MAX_OVERLAY_CONFIG = 32 * 1024;

  function withoutServerOwned(patch: Record<string, unknown>): Record<string, unknown> {
    const out = { ...patch };
    for (const k of SERVER_OWNED) delete out[k];
    if (out.goals && typeof out.goals === "object") {
      const goals = { ...(out.goals as Record<string, unknown>) };
      delete goals.donations;
      out.goals = goals;
    }
    return out;
  }

  function saveOverlayConfig(s: Streamer, patch: Record<string, unknown>) {
    const next = deepMerge(s.overlayConfig ?? {}, withoutServerOwned(patch)) as Record<string, unknown>;
    if (JSON.stringify(next).length > MAX_OVERLAY_CONFIG) return;
    s.overlayConfig = next;
    store.save();
  }

  // Messages from the streamer's /control panel: enforce plan limits, persist settings.
  hub.filter = (channel, message) => {
    const s = store.streamerById(channel);
    if (!s) return null;
    switch (message.kind) {
      case "theme-change":
        if (!themesFor(s).includes(String(message.theme))) return null;
        s.theme = String(message.theme);
        store.save();
        return message;
      case "config-patch": {
        const patch = (message.patch ?? {}) as Record<string, unknown>;
        if (typeof patch !== "object") return null;
        saveOverlayConfig(s, patch);
        // Theme only through theme-change (plan-checked); identity and donations stay server-side.
        return { kind: "config-patch", patch: withoutServerOwned(patch) };
      }
      case "performance-change":
        saveOverlayConfig(s, { performanceProfile: message.profile, reducedMotion: message.reducedMotion });
        return message;
      case "widget-toggle":
        if (typeof message.widget === "string") saveOverlayConfig(s, { widgets: { [message.widget]: { enabled: message.enabled === true } } });
        return message;
      default:
        return message;
    }
  };

  function overlayPatch(req: IncomingMessage, streamer: Streamer) {
    return {
      ...(streamer.overlayConfig ?? {}),
      pseudo: streamer.displayName,
      support: { url: `${baseUrl(req)}/s/${streamer.slug}` },
      communityName: streamer.communityName,
      goals: {
        ...((streamer.overlayConfig?.goals as Record<string, unknown> | undefined) ?? {}),
        donations: { current: payments.goalProgress(streamer), target: streamer.goal.target, label: streamer.goal.label },
      },
    };
  }

  function publicStreamer(s: Streamer) {
    return {
      id: s.id,
      email: s.email,
      displayName: s.displayName,
      slug: s.slug,
      plan: s.plan,
      theme: s.theme,
      communityName: s.communityName,
      page: s.page,
      goal: s.goal,
      showMessages: s.showMessages,
      blockedWords: s.blockedWords,
      payout: { method: s.payout.method, phone: s.payout.phone, masked: s.payout.phone ? maskPhone(s.payout.phone) : null },
      createdAt: s.createdAt,
    };
  }

  // ───────────────────────── Public (fans) ─────────────────────────
  router.add("GET", "/api/health", ({ res }) => sendJson(res, 200, { ok: true, provider: provider.name, livemode: provider.livemode }));

  router.add("GET", "/api/public/streamers/:slug", ({ res, params }) => {
    const s = store.streamerBySlug(params.slug.toLowerCase());
    if (!s) throw new HttpError(404, "Ce streamer n'existe pas (encore) sur Jokko.", "not_found");
    sendJson(res, 200, {
      displayName: s.displayName,
      slug: s.slug,
      theme: s.theme,
      communityName: s.communityName,
      page: s.page,
      goal: { label: s.goal.label, target: s.goal.target, current: payments.goalProgress(s) },
      methods: PAYMENT_METHODS.map((id) => ({ id, label: METHOD_LABELS[id] })),
      minAmount: cfg.minAmount,
      maxAmount: cfg.maxAmount,
      testMode: !provider.livemode,
      ranks: RANKS,
    });
  });

  router.add("POST", "/api/public/streamers/:slug/payments", async (ctx) => {
    limits.pay.check(ctx.ip);
    const s = store.streamerBySlug(ctx.params.slug.toLowerCase());
    if (!s) throw new HttpError(404, "Streamer introuvable.", "not_found");
    const body = (await readBody(ctx.req)) as Record<string, unknown>;
    if (!isPaymentMethod(body.method)) throw new HttpError(400, "Choisis Wave, Orange Money ou Free Money.", "invalid_method");
    try {
      const result = await payments.create({
        streamer: s,
        amount: body.amount,
        method: body.method,
        fanName: body.name,
        fanMessage: body.message,
        phone: body.phone,
        baseUrl: baseUrl(ctx.req),
      });
      sendJson(ctx.res, 201, result);
    } catch (err) {
      if (err instanceof HttpError) throw err;
      console.error("[jokko] création de paiement impossible :", err);
      throw new HttpError(502, "Le service de paiement ne répond pas. Réessaie dans un instant.", "provider_unavailable");
    }
  });

  router.add("GET", "/api/public/payments/:ref", async ({ res, params, ip }) => {
    limits.status.check(ip);
    const p = store.paymentByRef(params.ref);
    if (!p) throw new HttpError(404, "Paiement introuvable.", "not_found");
    await payments.refresh(p);
    const s = store.streamerById(p.streamerId);
    const fan = p.status === "completed" ? payments.fanRank(p) : null;
    sendJson(res, 200, {
      ref: p.ref,
      status: p.status,
      amount: p.amount,
      method: p.method,
      methodLabel: METHOD_LABELS[p.method],
      fanName: p.fanName,
      streamer: s ? { displayName: s.displayName, slug: s.slug } : null,
      fan: fan ? { rank: fan.rank, total: fan.total, streamers: fan.streamers, next: nextRank(fan.total) } : null,
      testMode: !p.livemode,
    });
  });

  // Some aggregators probe the notification URL with a GET before using it.
  router.add("GET", "/api/webhooks/:provider", ({ res, params }) => {
    if (params.provider !== provider.name) throw new HttpError(404, "Fournisseur inconnu.", "not_found");
    sendJson(res, 200, { ok: true });
  });

  router.add("POST", "/api/webhooks/:provider", async ({ req, res, params }) => {
    if (params.provider !== provider.name) throw new HttpError(404, "Fournisseur inconnu.", "not_found");
    const body = await readBody(req);
    const ok = await payments.handleWebhook(body);
    if (!ok) throw new HttpError(401, "Notification non authentifiée.", "bad_signature");
    sendJson(res, 200, { ok: true });
  });

  // Simulator (only when no real provider is configured).
  if (provider instanceof SimulatedProvider) {
    router.add("GET", "/api/sim/payments/:ref", ({ res, params }) => {
      const p = store.paymentByRef(params.ref);
      if (!p) throw new HttpError(404, "Paiement introuvable.", "not_found");
      const s = store.streamerById(p.streamerId);
      sendJson(res, 200, { ref: p.ref, amount: p.amount, method: p.method, methodLabel: METHOD_LABELS[p.method], status: p.status, streamer: s?.displayName ?? "", slug: s?.slug ?? "" });
    });
    router.add("POST", "/api/sim/payments/:ref/confirm", async ({ req, res, params }) => {
      const p = store.paymentByRef(params.ref);
      if (!p || !p.providerToken) throw new HttpError(404, "Paiement introuvable.", "not_found");
      const body = (await readBody(req)) as { outcome?: string };
      const outcome = body.outcome === "failed" || body.outcome === "cancelled" ? body.outcome : "completed";
      await payments.handleWebhook(provider.notification(p.providerToken, outcome));
      const s = store.streamerById(p.streamerId);
      sendJson(res, 200, { status: p.status, returnUrl: `/s/${s?.slug ?? ""}?ref=${encodeURIComponent(p.ref)}${outcome === "cancelled" ? "&cancelled=1" : ""}` });
    });
  }

  // ───────────────────────── Overlay ─────────────────────────
  router.add("GET", "/api/overlay/state", ({ req, res, url }) => {
    const s = store.streamerByOverlayKey(url.searchParams.get("key") ?? "");
    if (!s) throw new HttpError(404, "Clé d'overlay invalide.", "bad_key");
    sendJson(res, 200, { theme: s.theme, patch: overlayPatch(req, s) });
  });

  // ───────────────────────── Accounts ─────────────────────────
  router.add("POST", "/api/auth/signup", async (ctx) => {
    limits.signup.check(ctx.ip);
    assertSameOrigin(ctx.req);
    const body = (await readBody(ctx.req)) as Record<string, unknown>;
    const email = validateEmail(body.email);
    const password = validatePassword(body.password);
    const slug = validateSlug(body.slug);
    const displayName = cleanText(body.displayName, 40);
    if (!displayName) throw new HttpError(400, "Choisis un nom de streamer.", "invalid_name");
    if (store.streamerByEmail(email)) throw new HttpError(409, "Un compte existe déjà avec cet e-mail.", "email_taken");
    if (store.streamerBySlug(slug)) throw new HttpError(409, "Cet identifiant est déjà pris.", "slug_taken");
    const now = Date.now();
    const streamer: Streamer = {
      id: randomId("str"),
      email,
      passwordHash: await hashPassword(password),
      displayName,
      slug,
      plan: "free",
      createdAt: now,
      overlayKey: randomId("ovk", 18),
      hookKey: randomId("hk", 18),
      theme: "dakar-neon",
      communityName: `Team ${displayName}`,
      page: {
        title: `Soutiens ${displayName}`,
        message: "Chaque soutien m'aide à streamer plus et mieux. Jërëjëf !",
        suggestedAmounts: [500, 1000, 2500, 5000],
      },
      goal: { label: "OBJECTIF DONS", target: 50_000, since: now },
      showMessages: true,
      blockedWords: [],
      payout: { method: "wave", phone: null },
    };
    store.data.streamers.push(streamer);
    const session = createSession(store, streamer.id);
    sendJson(ctx.res, 201, { streamer: publicStreamer(streamer) }, {
      "Set-Cookie": `${SESSION_COOKIE}=${session.token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${session.maxAgeSec}${secureCookie()}`,
    });
  });

  router.add("POST", "/api/auth/login", async (ctx) => {
    assertSameOrigin(ctx.req);
    const body = (await readBody(ctx.req)) as Record<string, unknown>;
    const email = String(body.email ?? "").trim().toLowerCase();
    limits.auth.check(`${ctx.ip}:${email}`);
    const s = store.streamerByEmail(email);
    // Same scrypt cost whether or not the account exists: no e-mail enumeration by timing.
    const ok = s ? await verifyPassword(String(body.password ?? ""), s.passwordHash) : (await hashPassword("jokko-timing-pad"), false);
    if (!s || !ok) throw new HttpError(401, "E-mail ou mot de passe incorrect.", "bad_credentials");
    const session = createSession(store, s.id);
    sendJson(ctx.res, 200, { streamer: publicStreamer(s) }, {
      "Set-Cookie": `${SESSION_COOKIE}=${session.token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${session.maxAgeSec}${secureCookie()}`,
    });
  });

  const RESET_TTL_MS = 30 * 60_000;

  router.add("POST", "/api/auth/forgot", async (ctx) => {
    limits.forgot.check(ctx.ip);
    assertSameOrigin(ctx.req);
    const body = (await readBody(ctx.req)) as Record<string, unknown>;
    const s = store.streamerByEmail(String(body.email ?? "").trim().toLowerCase());
    if (s) {
      const token = randomId("rst", 24);
      const now = Date.now();
      store.data.resets = store.data.resets.filter((r) => r.expiresAt > now && r.streamerId !== s.id);
      store.data.resets.push({ tokenHash: sha256(token), streamerId: s.id, expiresAt: now + RESET_TTL_MS });
      store.save();
      const link = `${baseUrl(ctx.req)}/dashboard?reset=${encodeURIComponent(token)}`;
      // Not awaited: the response time must not reveal whether the account exists.
      mailer
        .send({
          to: s.email,
          subject: "Jokko — réinitialise ton mot de passe",
          text: `Salut ${s.displayName},\n\nPour choisir un nouveau mot de passe, ouvre ce lien (valable 30 minutes) :\n${link}\n\nSi tu n'as rien demandé, ignore cet e-mail : ton mot de passe actuel reste valable.\n\n— Jokko`,
        })
        .catch((err) => console.error("[jokko] e-mail de réinitialisation non envoyé :", err));
    }
    sendJson(ctx.res, 200, { ok: true });
  });

  router.add("POST", "/api/auth/reset", async (ctx) => {
    limits.auth.check(ctx.ip);
    assertSameOrigin(ctx.req);
    const body = (await readBody(ctx.req)) as Record<string, unknown>;
    const password = validatePassword(body.password);
    const hash = sha256(String(body.token ?? ""));
    const reset = store.data.resets.find((r) => r.tokenHash === hash && r.expiresAt > Date.now());
    const s = reset ? store.streamerById(reset.streamerId) : undefined;
    if (!reset || !s) throw new HttpError(400, "Lien expiré ou déjà utilisé. Refais une demande.", "invalid_reset");
    s.passwordHash = await hashPassword(password);
    // A reset logs out every other device and burns every pending link.
    store.data.sessions = store.data.sessions.filter((x) => x.streamerId !== s.id);
    store.data.resets = store.data.resets.filter((x) => x.streamerId !== s.id);
    const session = createSession(store, s.id);
    sendJson(ctx.res, 200, { streamer: publicStreamer(s) }, {
      "Set-Cookie": `${SESSION_COOKIE}=${session.token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${session.maxAgeSec}${secureCookie()}`,
    });
  });

  router.add("POST", "/api/auth/logout", ({ req, res }) => {
    destroySession(store, parseCookies(req.headers.cookie)[SESSION_COOKIE]);
    sendJson(res, 200, { ok: true }, { "Set-Cookie": `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0` });
  });

  // ───────────────────────── Streamer dashboard ─────────────────────────
  router.add("GET", "/api/dashboard", (ctx) => {
    const s = auth(ctx);
    const own = store.data.payments.filter((p) => p.streamerId === s.id && p.livemode === provider.livemode);
    const history = own
      .filter((p) => p.status !== "pending" || Date.now() - p.createdAt < 3600_000)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 200)
      .map((p) => ({
        ref: p.ref,
        amount: p.amount,
        net: p.net,
        commission: p.commission,
        method: p.method,
        methodLabel: METHOD_LABELS[p.method],
        fanName: p.fanName,
        fanMessage: p.fanMessage,
        rank: p.fanKey && store.fan(p.fanKey) ? rankFor(store.fan(p.fanKey)!.total).label : null,
        status: p.status,
        createdAt: p.createdAt,
        completedAt: p.completedAt,
      }));
    const withdrawals = store.data.withdrawals
      .filter((w) => w.streamerId === s.id && w.livemode === provider.livemode)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((w) => ({ id: w.id, amount: w.amount, phone: maskPhone(w.phone), status: w.status, createdAt: w.createdAt, processedAt: w.processedAt, note: w.note }));
    sendJson(ctx.res, 200, {
      streamer: publicStreamer(s),
      balance: payments.balance(s),
      goal: { label: s.goal.label, target: s.goal.target, current: payments.goalProgress(s) },
      payments: history,
      withdrawals,
      overlay: { key: s.overlayKey, urls: overlayUrls(ctx.req, s) },
      hooks: { url: `${baseUrl(ctx.req)}/api/hooks/${s.hookKey}`, types: HOOK_TYPES },
      supportUrl: `${baseUrl(ctx.req)}/s/${s.slug}`,
      themes: THEMES.map((id) => ({ id, available: themesFor(s).includes(id) })),
      commissionRate: payments.commissionRate(s),
      limits: { minAmount: cfg.minAmount, maxAmount: cfg.maxAmount, minWithdrawal: cfg.minWithdrawal },
      testMode: !provider.livemode,
      provider: provider.name,
    });
  });

  router.add("PATCH", "/api/settings", async (ctx) => {
    const s = auth(ctx, true);
    const body = (await readBody(ctx.req)) as Record<string, any>;
    if (body.displayName !== undefined) s.displayName = cleanText(body.displayName, 40, s.displayName);
    if (body.communityName !== undefined) s.communityName = cleanText(body.communityName, 40, s.communityName);
    if (body.page) {
      if (body.page.title !== undefined) s.page.title = cleanText(body.page.title, 60, s.page.title);
      if (body.page.message !== undefined) s.page.message = cleanText(body.page.message, 280);
      if (Array.isArray(body.page.suggestedAmounts)) {
        const amounts = body.page.suggestedAmounts.slice(0, 4).map((a: unknown) => parseAmount(a, cfg.minAmount, cfg.maxAmount));
        if (amounts.length) s.page.suggestedAmounts = amounts;
      }
    }
    if (body.goal) {
      if (body.goal.label !== undefined) s.goal.label = cleanText(body.goal.label, 30, s.goal.label);
      if (body.goal.target !== undefined) s.goal.target = parseAmount(body.goal.target, 1_000, 100_000_000);
      if (body.goal.reset === true) s.goal.since = Date.now();
    }
    if (body.theme !== undefined) {
      if (!(THEMES as readonly string[]).includes(body.theme)) throw new HttpError(400, "Thème inconnu.", "invalid_theme");
      if (!themesFor(s).includes(body.theme)) throw new HttpError(403, "Ce thème fait partie de l'offre Pro.", "plan_required");
      s.theme = body.theme;
      hub.publish(s.id, { kind: "theme-change", theme: s.theme });
    }
    if (typeof body.showMessages === "boolean") s.showMessages = body.showMessages;
    if (Array.isArray(body.blockedWords)) {
      s.blockedWords = body.blockedWords.slice(0, 50).map((w: unknown) => cleanText(w, 30)).filter(Boolean);
    }
    store.save();
    hub.publish(s.id, { kind: "config-patch", patch: overlayPatch(ctx.req, s) });
    sendJson(ctx.res, 200, { streamer: publicStreamer(s) });
  });

  router.add("PUT", "/api/payout", async (ctx) => {
    const s = auth(ctx, true);
    const body = (await readBody(ctx.req)) as Record<string, unknown>;
    const phone = normalizeSenegalPhone(String(body.phone ?? ""));
    if (!phone) throw new HttpError(400, "Numéro Wave invalide (ex. 77 123 45 67).", "invalid_phone");
    s.payout = { method: "wave", phone };
    store.save();
    sendJson(ctx.res, 200, { streamer: publicStreamer(s) });
  });

  router.add("POST", "/api/withdrawals", async (ctx) => {
    const s = auth(ctx, true);
    const body = (await readBody(ctx.req)) as Record<string, unknown>;
    const w = payments.requestWithdrawal(s, body.amount);
    sendJson(ctx.res, 201, { withdrawal: { id: w.id, amount: w.amount, status: w.status }, balance: payments.balance(s) });
  });

  router.add("POST", "/api/overlay/rotate-key", (ctx) => {
    const s = auth(ctx, true);
    s.overlayKey = randomId("ovk", 18);
    store.save();
    sendJson(ctx.res, 200, { overlay: { key: s.overlayKey, urls: overlayUrls(ctx.req, s) } });
  });

  router.add("POST", "/api/overlay/test-alert", async (ctx) => {
    const s = auth(ctx, true);
    const body = (await readBody(ctx.req)) as Record<string, unknown>;
    const names = ["Awa", "Modou", "Fatou", "Ibrahima", "Khady", "Cheikh", "Astou", "Ousmane"];
    const amount = [500, 1000, 2500, 5000, 15000][Math.floor(Math.random() * 5)];
    const method = PAYMENT_METHODS[Math.floor(Math.random() * PAYMENT_METHODS.length)];
    payments.announce(
      s,
      {
        fanName: names[Math.floor(Math.random() * names.length)],
        fanMessage: cleanText(body.message, 140) || "Test d'alerte Jokko — on est ensemble !",
        amount: Number.isInteger(body.amount) ? (body.amount as number) : amount,
        method,
      },
      RANKS[Math.floor(Math.random() * RANKS.length)],
      true
    );
    sendJson(ctx.res, 200, { ok: true });
  });

  router.add("GET", "/api/payments.csv", (ctx) => {
    const s = auth(ctx);
    const rows = store.data.payments
      .filter((p) => p.streamerId === s.id && p.livemode === provider.livemode && p.status !== "pending")
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((p) => [
        new Date(p.createdAt).toISOString(),
        p.ref,
        p.fanName,
        p.fanKey && store.fan(p.fanKey) ? rankFor(store.fan(p.fanKey)!.total).label : "",
        METHOD_LABELS[p.method],
        p.amount,
        p.status === "completed" ? p.commission : 0,
        p.status === "completed" ? p.net : 0,
        p.status,
        p.fanMessage,
      ]);
    ctx.res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="jokko-${s.slug}-paiements${provider.livemode ? "" : "-test"}.csv"`,
      "Cache-Control": "no-store",
    });
    ctx.res.end(toCsv(rows));
  });

  // ───────────────────────── Integrations (Streamer.bot, TikFinity…) ─────────────────────────
  async function hook(ctx: Ctx) {
    limits.hooks.check(ctx.params.key);
    const s = store.streamerByHookKey(ctx.params.key);
    if (!s) throw new HttpError(404, "Clé d'intégration invalide.", "bad_key");
    const input =
      ctx.req.method === "GET" ? Object.fromEntries(ctx.url.searchParams) : ((await readBody(ctx.req)) as Record<string, unknown>);
    const messages = hookMessages(input, s.blockedWords);
    for (const m of messages) hub.publish(s.id, m);
    sendJson(ctx.res, 200, { ok: true, delivered: messages.length });
  }
  router.add("POST", "/api/hooks/rotate", (ctx) => {
    const s = auth(ctx, true);
    s.hookKey = randomId("hk", 18);
    store.save();
    sendJson(ctx.res, 200, { hooks: { url: `${baseUrl(ctx.req)}/api/hooks/${s.hookKey}` } });
  });
  router.add("POST", "/api/hooks/:key", hook);
  router.add("GET", "/api/hooks/:key", hook);

  // ───────────────────────── Admin (withdrawal processing) ─────────────────────────
  router.add("GET", "/api/admin/stats", (ctx) => {
    admin(ctx);
    const live = provider.livemode;
    let volume = 0;
    let commission = 0;
    let count = 0;
    for (const p of store.data.payments) {
      if (p.livemode !== live || p.status !== "completed") continue;
      volume += p.amount;
      commission += p.commission;
      count += 1;
    }
    const pending = store.data.withdrawals.filter((w) => w.livemode === live && w.status === "pending");
    sendJson(ctx.res, 200, {
      livemode: live,
      provider: provider.name,
      streamers: store.data.streamers.length,
      pro: store.data.streamers.filter((s) => s.plan === "pro").length,
      payments: count,
      volume,
      commission,
      fans: store.data.fans.filter((f) => f.key.startsWith(live ? "live:" : "test:")).length,
      pendingWithdrawals: { count: pending.length, amount: pending.reduce((n, w) => n + w.amount, 0) },
    });
  });

  router.add("GET", "/api/admin/streamers", (ctx) => {
    admin(ctx);
    const list = store.data.streamers
      .map((s) => {
        const b = payments.balance(s);
        return { id: s.id, slug: s.slug, displayName: s.displayName, email: s.email, plan: s.plan, createdAt: s.createdAt, received: b.received, available: b.available, payout: s.payout.phone };
      })
      .sort((a, b) => b.received - a.received);
    sendJson(ctx.res, 200, { streamers: list });
  });

  router.add("GET", "/api/admin/withdrawals", (ctx) => {
    admin(ctx);
    const status = ctx.url.searchParams.get("status");
    const list = store.data.withdrawals
      .filter((w) => w.livemode === provider.livemode && (!status || w.status === status))
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((w) => ({ ...w, streamer: store.streamerById(w.streamerId)?.slug ?? null }));
    sendJson(ctx.res, 200, { withdrawals: list });
  });

  router.add("POST", "/api/admin/withdrawals/:id", async (ctx) => {
    admin(ctx);
    const w = store.data.withdrawals.find((x) => x.id === ctx.params.id);
    if (!w) throw new HttpError(404, "Retrait introuvable.", "not_found");
    if (w.status !== "pending") throw new HttpError(409, "Ce retrait a déjà été traité.", "already_processed");
    const body = (await readBody(ctx.req)) as Record<string, unknown>;
    if (body.status !== "paid" && body.status !== "rejected") throw new HttpError(400, "status doit valoir paid ou rejected.");
    w.status = body.status;
    w.processedAt = Date.now();
    w.note = cleanText(body.note, 200);
    store.save();
    sendJson(ctx.res, 200, { withdrawal: w });
  });

  router.add("POST", "/api/admin/streamers/:slug/plan", async (ctx) => {
    admin(ctx);
    const s = store.streamerBySlug(ctx.params.slug);
    if (!s) throw new HttpError(404, "Streamer introuvable.", "not_found");
    const body = (await readBody(ctx.req)) as Record<string, unknown>;
    if (body.plan !== "free" && body.plan !== "pro") throw new HttpError(400, "plan doit valoir free ou pro.");
    s.plan = body.plan;
    if (!themesFor(s).includes(s.theme)) s.theme = "dakar-neon";
    store.save();
    sendJson(ctx.res, 200, { streamer: publicStreamer(s) });
  });

  return {
    store,
    hub,
    payments,
    provider,
    mailer,
    async handle(req, res) {
      if (!req.url?.startsWith("/api/")) return false;
      res.setHeader("X-Content-Type-Options", "nosniff");
      const handled = await router.handle(req, res);
      if (!handled) sendJson(res, 404, { error: "Route inconnue.", code: "not_found" });
      return true;
    },
    close() {
      clearTimeout(firstBackup);
      clearInterval(dailyBackup);
      hub.close();
      store.flush();
    },
  };
}
