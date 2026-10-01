import { afterEach, describe, expect, it } from "vitest";
import { startServer } from "./helpers";
import { ResendMailer } from "../mailer";

let ctx: Awaited<ReturnType<typeof startServer>> | null = null;
afterEach(async () => {
  await ctx?.close();
  ctx = null;
});

describe("mot de passe oublié", () => {
  it("envoie un lien à usage unique qui déconnecte les autres appareils", async () => {
    ctx = await startServer();
    await ctx.api("POST", "/api/auth/signup", { email: "awa@example.com", password: "ancienmdp1", displayName: "Awa", slug: "awa" });
    const oldCookie = ctx.getCookie();

    // Unknown e-mail: same answer, no e-mail sent (no account enumeration).
    expect((await ctx.api("POST", "/api/auth/forgot", { email: "personne@example.com" })).json).toEqual({ ok: true });
    expect((await ctx.api("POST", "/api/auth/forgot", { email: "AWA@example.com" })).json).toEqual({ ok: true });
    await new Promise((r) => setTimeout(r, 20));
    expect(ctx.mailer.sent).toHaveLength(1);
    expect(ctx.mailer.sent[0].to).toBe("awa@example.com");
    const token = decodeURIComponent(/reset=([^\s]+)/.exec(ctx.mailer.sent[0].text)![1]);

    expect((await ctx.api("POST", "/api/auth/reset", { token: "faux", password: "nouveaumdp1" })).status).toBe(400);
    expect((await ctx.api("POST", "/api/auth/reset", { token, password: "court" })).status).toBe(400);
    expect((await ctx.api("POST", "/api/auth/reset", { token, password: "nouveaumdp1" })).status).toBe(200);
    expect((await ctx.api("GET", "/api/dashboard")).status).toBe(200); // new session cookie set

    // Link is single-use; old session is revoked; old password no longer works.
    expect((await ctx.api("POST", "/api/auth/reset", { token, password: "autremdp99" })).status).toBe(400);
    ctx.setCookie(oldCookie);
    expect((await ctx.api("GET", "/api/dashboard")).status).toBe(401);
    expect((await ctx.api("POST", "/api/auth/login", { email: "awa@example.com", password: "ancienmdp1" })).status).toBe(401);
    expect((await ctx.api("POST", "/api/auth/login", { email: "awa@example.com", password: "nouveaumdp1" })).status).toBe(200);
  });

  it("ResendMailer appelle l'API HTTP avec la clé en en-tête", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const mailer = new ResendMailer("re_test", "Jokko <noreply@jokko.sn>", (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response("{}", { status: 200 });
    }) as typeof fetch);
    await mailer.send({ to: "a@example.com", subject: "S", text: "T" });
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect((calls[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(String(calls[0].init?.body))).toMatchObject({ to: ["a@example.com"], from: "Jokko <noreply@jokko.sn>" });
  });
});

describe("console admin", () => {
  it("statistiques, liste des streamers et refus de retrait qui libère le solde", async () => {
    ctx = await startServer();
    const auth = { Authorization: "Bearer admin-token-0123456789" };
    await ctx.api("POST", "/api/auth/signup", { email: "awa@example.com", password: "motdepasse1", displayName: "Awa", slug: "awa" });
    const r = await ctx.api("POST", "/api/public/streamers/awa/payments", { method: "wave", amount: 5000 });
    await ctx.api("POST", `/api/sim/payments/${r.json.ref}/confirm`, {});
    await ctx.api("PUT", "/api/payout", { phone: "771234567" });
    await ctx.api("POST", "/api/withdrawals", { amount: 3000 });

    expect((await ctx.api("GET", "/api/admin/stats")).status).toBe(401);
    const stats = (await ctx.api("GET", "/api/admin/stats", undefined, auth)).json;
    expect(stats).toMatchObject({ streamers: 1, payments: 1, volume: 5000, commission: 500, pendingWithdrawals: { count: 1, amount: 3000 } });
    const list = (await ctx.api("GET", "/api/admin/streamers", undefined, auth)).json.streamers;
    expect(list[0]).toMatchObject({ slug: "awa", received: 5000, available: 1500, payout: "+221771234567" });

    const wd = (await ctx.api("GET", "/api/admin/withdrawals?status=pending", undefined, auth)).json.withdrawals[0];
    expect(wd.phone).toBe("+221771234567"); // full number: the operator must be able to pay it
    await ctx.api("POST", `/api/admin/withdrawals/${wd.id}`, { status: "rejected", note: "numéro à vérifier" }, auth);
    expect((await ctx.api("POST", `/api/admin/withdrawals/${wd.id}`, { status: "paid" }, auth)).status).toBe(409);
    const dash = (await ctx.api("GET", "/api/dashboard")).json;
    expect(dash.balance.available).toBe(4500);
    expect(dash.withdrawals[0]).toMatchObject({ status: "rejected", note: "numéro à vérifier" });
  });
});
