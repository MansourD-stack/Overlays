import { afterEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import WebSocket from "ws";
import { startServer } from "./helpers";
import { PayDunyaProvider } from "../payments/paydunya";
import { SimulatedProvider } from "../payments/simulated";

let ctx: Awaited<ReturnType<typeof startServer>> | null = null;
afterEach(async () => {
  await ctx?.close();
  ctx = null;
});

async function signup(c: NonNullable<typeof ctx>, slug = "awa-gaming") {
  const r = await c.api("POST", "/api/auth/signup", { email: `${slug}@example.com`, password: "motdepasse1", displayName: "Awa Gaming", slug });
  expect(r.status).toBe(201);
  return r.json.streamer;
}

async function pay(c: NonNullable<typeof ctx>, slug: string, body: Record<string, unknown>) {
  return c.api("POST", `/api/public/streamers/${slug}/payments`, { method: "wave", amount: 1000, ...body });
}

describe("parcours de paiement (simulé)", () => {
  it("fan paie → confirmation → alerte overlay → historique + solde → retrait", async () => {
    ctx = await startServer();
    await signup(ctx);
    const dash0 = await ctx.api("GET", "/api/dashboard");
    const key = dash0.json.overlay.key;

    // An overlay listens with its read-only key.
    const ws = new WebSocket(`${ctx.base.replace("http", "ws")}/overlay-bridge?key=${key}`);
    const messages: any[] = [];
    ws.on("message", (d) => messages.push(JSON.parse(d.toString())));
    await new Promise((r) => ws.on("open", r));

    const created = await pay(ctx, "awa-gaming", { amount: 2500, name: "Modou", message: "Allez ! https://spam.io", phone: "77 123 45 67" });
    expect(created.status).toBe(201);
    expect(created.json.redirectUrl).toMatch(/^\/pay\/sim\//);
    const ref = created.json.ref;

    expect((await ctx.api("GET", `/api/public/payments/${ref}`)).json.status).toBe("pending");

    const t0 = Date.now();
    const confirm = await ctx.api("POST", `/api/sim/payments/${ref}/confirm`, { outcome: "completed" });
    expect(confirm.json.status).toBe("completed");
    const status = await ctx.api("GET", `/api/public/payments/${ref}`);
    expect(status.json.status).toBe("completed");
    expect(status.json.fan.rank.id).toBe("bronze");
    expect(Date.now() - t0).toBeLessThan(10_000);

    await new Promise((r) => setTimeout(r, 50));
    const alert = messages.find((m) => m.kind === "event");
    expect(alert.event.type).toBe("donation");
    expect(alert.event.payload).toMatchObject({ username: "Modou", amount: 2500, method: "wave", test: true });
    expect(alert.event.payload.message).toContain("[lien]");
    const goal = messages.find((m) => m.kind === "config-patch");
    expect(goal.patch.goals.donations.current).toBe(2500);

    // Replayed notification must not credit twice or replay the alert.
    await ctx.api("POST", `/api/sim/payments/${ref}/confirm`, { outcome: "completed" });
    await new Promise((r) => setTimeout(r, 50));
    expect(messages.filter((m) => m.kind === "event")).toHaveLength(1);

    const dash = await ctx.api("GET", "/api/dashboard");
    expect(dash.json.balance).toMatchObject({ received: 2500, commission: 250, net: 2250, available: 2250 });
    expect(dash.json.payments[0]).toMatchObject({ fanName: "Modou", status: "completed", amount: 2500 });

    // Withdrawal needs a Wave number, a minimum, and enough balance.
    expect((await ctx.api("POST", "/api/withdrawals", { amount: 1000 })).json.code).toBe("no_payout");
    expect((await ctx.api("PUT", "/api/payout", { phone: "12" })).status).toBe(400);
    expect((await ctx.api("PUT", "/api/payout", { phone: "78 000 11 22" })).json.streamer.payout.phone).toBe("+221780001122");
    expect((await ctx.api("POST", "/api/withdrawals", { amount: 500 })).status).toBe(400);
    expect((await ctx.api("POST", "/api/withdrawals", { amount: 5000 })).json.code).toBe("insufficient_balance");
    const wd = await ctx.api("POST", "/api/withdrawals", { amount: 2000 });
    expect(wd.status).toBe(201);
    expect(wd.json.balance.available).toBe(250);

    // Admin marks it paid.
    const list = await ctx.api("GET", "/api/admin/withdrawals?status=pending", undefined, { Authorization: "Bearer admin-token-0123456789" });
    expect(list.json.withdrawals).toHaveLength(1);
    const done = await ctx.api("POST", `/api/admin/withdrawals/${list.json.withdrawals[0].id}`, { status: "paid" }, { Authorization: "Bearer admin-token-0123456789" });
    expect(done.json.withdrawal.status).toBe("paid");
    expect((await ctx.api("GET", "/api/admin/withdrawals", undefined, { Authorization: "Bearer nope" })).status).toBe(401);
    ws.close();
  });

  it("rang Teranga cumulé chez plusieurs streamers", async () => {
    ctx = await startServer();
    await signup(ctx, "streamer-un");
    await signup(ctx, "streamer-deux");
    for (const [slug, amount] of [["streamer-un", 6000], ["streamer-deux", 5000]] as const) {
      const r = await pay(ctx, slug, { amount, phone: "+221771112233" });
      await ctx.api("POST", `/api/sim/payments/${r.json.ref}/confirm`, {});
      const s = await ctx.api("GET", `/api/public/payments/${r.json.ref}`);
      if (slug === "streamer-deux") expect(s.json.fan).toMatchObject({ total: 11000, streamers: 2, rank: { id: "argent" } });
    }
  });

  it("refuse une notification falsifiée et les entrées invalides", async () => {
    ctx = await startServer();
    await signup(ctx);
    const r = await pay(ctx, "awa-gaming", {});
    const forged = await ctx.api("POST", "/api/webhooks/simulated", { token: `sim_${r.json.ref}`, status: "completed", signature: "00" });
    expect(forged.status).toBe(401);
    expect((await ctx.api("GET", `/api/public/payments/${r.json.ref}`)).json.status).toBe("pending");
    expect((await pay(ctx, "awa-gaming", { method: "paypal" })).status).toBe(400);
    expect((await pay(ctx, "awa-gaming", { amount: 50 })).status).toBe(400);
    expect((await pay(ctx, "awa-gaming", { phone: "0612345678" })).status).toBe(400);
    expect((await pay(ctx, "inconnu", {})).status).toBe(404);
  });

  it("paiement échoué : ni alerte ni crédit", async () => {
    ctx = await startServer();
    await signup(ctx);
    const r = await pay(ctx, "awa-gaming", {});
    await ctx.api("POST", `/api/sim/payments/${r.json.ref}/confirm`, { outcome: "failed" });
    expect((await ctx.api("GET", `/api/public/payments/${r.json.ref}`)).json.status).toBe("failed");
    expect((await ctx.api("GET", "/api/dashboard")).json.balance.available).toBe(0);
  });
});

describe("comptes et sécurité", () => {
  it("login/logout, doublons, CSRF, clé overlay en lecture seule", async () => {
    ctx = await startServer();
    await signup(ctx);
    expect((await ctx.api("POST", "/api/auth/signup", { email: "awa-gaming@example.com", password: "motdepasse1", displayName: "X", slug: "autre" })).status).toBe(409);
    await ctx.api("POST", "/api/auth/logout", {});
    expect((await ctx.api("GET", "/api/dashboard")).status).toBe(401);
    expect((await ctx.api("POST", "/api/auth/login", { email: "awa-gaming@example.com", password: "mauvais!!" })).status).toBe(401);
    expect((await ctx.api("POST", "/api/auth/login", { email: "awa-gaming@example.com", password: "motdepasse1" })).status).toBe(200);

    // Cross-site write rejected; form-encoded write rejected.
    expect((await ctx.api("PATCH", "/api/settings", { displayName: "Pirate" }, { Origin: "https://evil.example" })).status).toBe(403);
    expect((await ctx.api("PATCH", "/api/settings", "displayName=x", { "Content-Type": "application/x-www-form-urlencoded" })).status).toBe(415);

    // Free plan: only Dakar Neon.
    expect((await ctx.api("PATCH", "/api/settings", { theme: "night-mode" })).status).toBe(403);
    await ctx.api("POST", "/api/admin/streamers/awa-gaming/plan", { plan: "pro" }, { Authorization: "Bearer admin-token-0123456789" });
    expect((await ctx.api("PATCH", "/api/settings", { theme: "night-mode" })).json.streamer.theme).toBe("night-mode");

    // Overlay sockets opened with the key cannot inject events into the channel.
    const key = (await ctx.api("GET", "/api/dashboard")).json.overlay.key;
    const wsUrl = `${ctx.base.replace("http", "ws")}/overlay-bridge`;
    const viewer = new WebSocket(`${wsUrl}?key=${key}`);
    const other = new WebSocket(`${wsUrl}?key=${key}`);
    const received: string[] = [];
    other.on("message", (d) => received.push(d.toString()));
    await Promise.all([new Promise((r) => viewer.on("open", r)), new Promise((r) => other.on("open", r))]);
    viewer.send(JSON.stringify({ kind: "event", event: { type: "donation", payload: { amount: 999999 } } }));
    await new Promise((r) => setTimeout(r, 80));
    expect(received).toHaveLength(0);

    const bad = new WebSocket(`${wsUrl}?key=faux`);
    await expect(new Promise((_r, reject) => bad.on("error", reject))).rejects.toBeTruthy();
    viewer.close();
    other.close();

    const rotated = await ctx.api("POST", "/api/overlay/rotate-key", {});
    expect(rotated.json.overlay.key).not.toBe(key);
    expect((await ctx.api("GET", `/api/overlay/state?key=${key}`)).status).toBe(404);
    expect((await ctx.api("GET", `/api/overlay/state?key=${rotated.json.overlay.key}`)).json.patch.pseudo).toBe("Awa Gaming");
  });

  it("limitation de débit par fan derrière un reverse proxy", async () => {
    ctx = await startServer({ cfg: { trustProxy: true } });
    await signup(ctx);
    const from = (ip: string) => ctx!.api("POST", "/api/public/streamers/awa-gaming/payments", { method: "wave", amount: 1000 }, { "X-Forwarded-For": `${ip}, 10.0.0.1` });
    for (let i = 0; i < 10; i++) expect((await from("41.82.0.1")).status).toBe(201);
    expect((await from("41.82.0.1")).status).toBe(429);
    expect((await from("41.82.0.2")).status).toBe(201);
  });

  it("le canal local sans compte peut être désactivé", async () => {
    ctx = await startServer({ cfg: { allowLocalBridge: false } });
    const ws = new WebSocket(`${ctx.base.replace("http", "ws")}/overlay-bridge`);
    await expect(new Promise((_r, reject) => ws.on("error", reject))).rejects.toBeTruthy();
  });
});

describe("PayDunya", () => {
  const keys = { mode: "test" as const, masterKey: "master-xyz", privateKey: "priv", token: "tok" };

  function fakeFetch(confirmStatus = "completed", amount = 1000) {
    const calls: { url: string; init?: RequestInit }[] = [];
    const impl = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.endsWith("/checkout-invoice/create")) {
        return new Response(JSON.stringify({ response_code: "00", response_text: "https://app.paydunya.com/sandbox-checkout/invoice/test_abc", token: "test_abc" }));
      }
      return new Response(JSON.stringify({ response_code: "00", status: confirmStatus, invoice: { total_amount: amount } }));
    }) as typeof fetch;
    return { impl, calls };
  }

  it("crée une facture sandbox avec le bon canal et les clés en en-têtes", async () => {
    const { impl, calls } = fakeFetch();
    const p = new PayDunyaProvider(keys, "Jokko", impl);
    const r = await p.createCheckout({ ref: "jk_1", amount: 1000, method: "orange-money", description: "d", returnUrl: "r", cancelUrl: "c", callbackUrl: "cb" });
    expect(r).toEqual({ redirectUrl: "https://app.paydunya.com/sandbox-checkout/invoice/test_abc", providerToken: "test_abc" });
    expect(calls[0].url).toBe("https://app.paydunya.com/sandbox-api/v1/checkout-invoice/create");
    const body = JSON.parse(String(calls[0].init?.body));
    expect(body.channels).toEqual(["orange-money-senegal"]);
    expect(body.actions.callback_url).toBe("cb");
    expect((calls[0].init?.headers as Record<string, string>)["PAYDUNYA-MASTER-KEY"]).toBe("master-xyz");
  });

  it("IPN : vérifie le hash SHA-512 puis re-confirme via l'API", async () => {
    const { impl, calls } = fakeFetch("completed", 1000);
    const p = new PayDunyaProvider(keys, "Jokko", impl);
    const hash = createHash("sha512").update("master-xyz").digest("hex");
    expect(await p.parseWebhook({ data: { hash: "bad", invoice: { token: "test_abc" }, status: "completed" } })).toBeNull();
    expect(calls).toHaveLength(0);
    const ok = await p.parseWebhook({ data: { hash, invoice: { token: "test_abc" }, status: "completed" } });
    expect(ok).toEqual({ providerToken: "test_abc", status: "completed", amount: 1000 });
    expect(calls[0].url).toContain("/checkout-invoice/confirm/test_abc");
  });

  it("de bout en bout : montant incohérent → paiement refusé", async () => {
    const { impl } = fakeFetch("completed", 1);
    ctx = await startServer({ provider: new PayDunyaProvider(keys, "Jokko", impl) });
    await signup(ctx);
    const r = await pay(ctx, "awa-gaming", { amount: 1000 });
    expect(r.json.redirectUrl).toContain("paydunya.com");
    const hash = createHash("sha512").update("master-xyz").digest("hex");
    const form = new URLSearchParams({ "data[hash]": hash, "data[invoice][token]": "test_abc", "data[status]": "completed" }).toString();
    const ipn = await ctx.api("POST", "/api/webhooks/paydunya", form, { "Content-Type": "application/x-www-form-urlencoded" });
    expect(ipn.status).toBe(200);
    expect((await ctx.api("GET", `/api/public/payments/${r.json.ref}`)).json.status).toBe("failed");
  });

  it("simulateur absent quand PayDunya est actif", async () => {
    const { impl } = fakeFetch();
    ctx = await startServer({ provider: new PayDunyaProvider(keys, "Jokko", impl) });
    expect((await ctx.api("GET", "/api/sim/payments/x")).status).toBe(404);
    expect(new SimulatedProvider("s").livemode).toBe(false);
  });
});
