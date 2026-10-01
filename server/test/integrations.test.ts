import { afterEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { startServer } from "./helpers";
import { hookMessages, toCsv } from "../hooks";

let ctx: Awaited<ReturnType<typeof startServer>> | null = null;
afterEach(async () => {
  await ctx?.close();
  ctx = null;
});

describe("webhook d'intégration", () => {
  it("convertit les événements d'outils tiers", () => {
    const [gift] = hookMessages({ type: "gift", username: "Awa", giftName: "Lion", coins: "1500" }) as any[];
    expect(gift.event).toMatchObject({ type: "gift", payload: { username: "Awa", giftName: "Lion", tier: 3 } });
    const [likes] = hookMessages({ type: "likes", total: 4200 }) as any[];
    expect(likes).toEqual({ kind: "config-patch", patch: { goals: { likes: { current: 4200 } } } });
    const [msg] = hookMessages({ type: "message", text: "va sur https://x.io" }) as any[];
    expect(msg.event.payload.text).toBe("va sur [lien]");
    expect(() => hookMessages({ type: "donation", amount: 1000 })).toThrow(/type inconnu/);
  });

  it("publie sur le canal du streamer, en POST comme en GET, jamais de don", async () => {
    ctx = await startServer();
    await ctx.api("POST", "/api/auth/signup", { email: "a@example.com", password: "motdepasse1", displayName: "Awa", slug: "awa" });
    const dash = (await ctx.api("GET", "/api/dashboard")).json;
    const hookPath = new URL(dash.hooks.url).pathname;
    const ws = new WebSocket(`${ctx.base.replace("http", "ws")}/overlay-bridge?key=${dash.overlay.key}`);
    const got: any[] = [];
    ws.on("message", (d) => got.push(JSON.parse(d.toString())));
    await new Promise((r) => ws.on("open", r));

    expect((await ctx.api("POST", hookPath, { type: "follow", username: "Modou" })).status).toBe(200);
    expect((await ctx.api("GET", `${hookPath}?type=raid&username=Team%20X&viewers=42`)).status).toBe(200);
    expect((await ctx.api("POST", hookPath, { type: "donation", amount: 5000 })).status).toBe(400);
    expect((await ctx.api("POST", "/api/hooks/hk_faux", { type: "follow" })).status).toBe(404);
    await new Promise((r) => setTimeout(r, 50));
    expect(got.map((m) => m.event?.type)).toEqual(["follow", "raid"]);
    expect(got[1].event.payload).toMatchObject({ username: "Team X", viewers: 42 });

    const rotated = await ctx.api("POST", "/api/hooks/rotate", {});
    expect(rotated.json.hooks.url).not.toBe(dash.hooks.url);
    expect((await ctx.api("POST", hookPath, { type: "follow" })).status).toBe(404);
    ws.close();
  });
});

describe("export CSV", () => {
  it("neutralise les formules et échappe les séparateurs", () => {
    const csv = toCsv([["2026-10-01", "jk_1", "=HYPERLINK(\"x\")", "", "Wave", 1000, 100, 900, "completed", "salut; ça va"]]);
    expect(csv.startsWith("﻿Date;")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain(`"salut; ça va"`);
  });

  it("exporte les paiements terminés du streamer connecté", async () => {
    ctx = await startServer();
    await ctx.api("POST", "/api/auth/signup", { email: "a@example.com", password: "motdepasse1", displayName: "Awa", slug: "awa" });
    const r = await ctx.api("POST", "/api/public/streamers/awa/payments", { method: "wave", amount: 2000, name: "Modou" });
    await ctx.api("POST", `/api/sim/payments/${r.json.ref}/confirm`, {});
    await ctx.api("POST", "/api/public/streamers/awa/payments", { method: "wave", amount: 999 }); // pending → excluded
    expect((await fetch(`${ctx.base}/api/payments.csv`)).status).toBe(401);
    const res = await fetch(`${ctx.base}/api/payments.csv`, { headers: { Cookie: ctx.getCookie() } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("jokko-awa-paiements-test.csv");
    const lines = (await res.text()).trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toMatch(/;Modou;Bronze|;Modou;;Wave;2000;200;1800;completed;/);
  });
});

describe("réglages /control en mode hébergé", () => {
  it("sont enregistrés côté serveur, sans toucher à l'identité, aux dons ni aux limites de l'offre", async () => {
    ctx = await startServer();
    await ctx.api("POST", "/api/auth/signup", { email: "a@example.com", password: "motdepasse1", displayName: "Awa", slug: "awa" });
    const key = (await ctx.api("GET", "/api/dashboard")).json.overlay.key;
    const wsBase = `${ctx.base.replace("http", "ws")}/overlay-bridge`;
    const control = new WebSocket(wsBase, { headers: { Cookie: ctx.getCookie() } });
    const overlay = new WebSocket(`${wsBase}?key=${key}`);
    const got: any[] = [];
    overlay.on("message", (d) => got.push(JSON.parse(d.toString())));
    await Promise.all([new Promise((r) => control.on("open", r)), new Promise((r) => overlay.on("open", r))]);

    control.send(JSON.stringify({ kind: "config-patch", patch: { game: "Valorant", pseudo: "Pirate", theme: "night-mode", goals: { likes: { target: 9000 }, donations: { current: 999999 } } } }));
    control.send(JSON.stringify({ kind: "theme-change", theme: "night-mode" })); // free plan → dropped
    control.send(JSON.stringify({ kind: "widget-toggle", widget: "bossFight", enabled: true }));
    await new Promise((r) => setTimeout(r, 80));

    expect(got.map((m) => m.kind)).toEqual(["config-patch", "widget-toggle"]);
    expect(got[0].patch).toEqual({ game: "Valorant", goals: { likes: { target: 9000 } } });

    const state = (await ctx.api("GET", `/api/overlay/state?key=${key}`)).json;
    expect(state.theme).toBe("dakar-neon");
    expect(state.patch).toMatchObject({ game: "Valorant", pseudo: "Awa", widgets: { bossFight: { enabled: true } } });
    expect(state.patch.goals.likes.target).toBe(9000);
    expect(state.patch.goals.donations.current).toBe(0);
    control.close();
    overlay.close();
  });
});
