import type { IncomingMessage, ServerResponse } from "node:http";
import type { JokkoConfig } from "./config";
import { Store, type Streamer } from "./store";
import { RealtimeHub } from "./realtime";
import { Router, RateLimiter, readBody, sendJson, type Ctx } from "./http";
import { SESSION_COOKIE, createSession, destroySession, hashPassword, parseCookies, streamerForSession, verifyPassword } from "./auth";
import { PaymentService } from "./payments/service";
import { SimulatedProvider } from "./payments/simulated";
import { PayDunyaProvider } from "./payments/paydunya";
import type { PaymentProvider } from "./payments/provider";
import { RANKS, nextRank, rankFor } from "./ranks";
import { HttpError, randomId, safeEqual } from "./util";
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
  if (/^\/s\/[^/]+\/?$/.test(pathname)) return "support.html";
  if (/^\/pay\/sim\/[^/]+\/?$/.test(pathname)) return "pay-sim.html";
  return null;
}

/** Pages that handle money or accounts must never be framed by another site. */
export const PROTECTED_PAGES = new Set(["dashboard.html", "support.html", "pay-sim.html"]);

export interface JokkoApp {
  store: Store;
  hub: RealtimeHub;
  payments: PaymentService;
  provider: PaymentProvider;
  /** Handles /api/*; resolves true when it responded. */
  handle(req: IncomingMessage, res: ServerResponse): Promise<boolean>;
  close(): void;
}

export function createProvider(cfg: JokkoConfig): PaymentProvider {
  return cfg.provider === "paydunya" && cfg.paydunya ? new PayDunyaProvider(cfg.paydunya) : new SimulatedProvider(cfg.secret);
}

export function createJokkoApp(cfg: JokkoConfig, opts: { store?: Store; provider?: PaymentProvider } = {}): JokkoApp {
  const store = opts.store ?? new Store(cfg.dataDir);
  const hub = new RealtimeHub(store, cfg.allowLocalBridge);
  const provider = opts.provider ?? createProvider(cfg);
  const payments = new PaymentService(store, provider, cfg, hub);
  const router = new Router(cfg.trustProxy);

  const limits = {
    pay: new RateLimiter(10, 60_000),
    auth: new RateLimiter(10, 5 * 60_000),
    signup: new RateLimiter(5, 10 * 60_000),
    status: new RateLimiter(120, 60_000),
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

  function overlayPatch(streamer: Streamer) {
    return {
      pseudo: streamer.displayName,
      communityName: streamer.communityName,
      goals: { donations: { current: payments.goalProgress(streamer), target: streamer.goal.target, label: streamer.goal.label } },
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
  router.add("GET", "/api/overlay/state", ({ res, url }) => {
    const s = store.streamerByOverlayKey(url.searchParams.get("key") ?? "");
    if (!s) throw new HttpError(404, "Clé d'overlay invalide.", "bad_key");
    sendJson(res, 200, { theme: s.theme, patch: overlayPatch(s) });
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
    hub.publish(s.id, { kind: "config-patch", patch: overlayPatch(s) });
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

  // ───────────────────────── Admin (withdrawal processing) ─────────────────────────
  router.add("GET", "/api/admin/withdrawals", (ctx) => {
    admin(ctx);
    const status = ctx.url.searchParams.get("status");
    const list = store.data.withdrawals
      .filter((w) => !status || w.status === status)
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
    async handle(req, res) {
      if (!req.url?.startsWith("/api/")) return false;
      res.setHeader("X-Content-Type-Options", "nosniff");
      const handled = await router.handle(req, res);
      if (!handled) sendJson(res, 404, { error: "Route inconnue.", code: "not_found" });
      return true;
    },
    close() {
      hub.close();
      store.flush();
    },
  };
}
