import "../jokko.css";
import "../dashboard/dashboard.css";
import { api, ApiError } from "../api";
import { STATUS_LABELS, dateTime, fcfa } from "../format";
import { banner, button, el, field, input, toast } from "../ui";

/* Jokko operator console (/admin): process withdrawal requests, switch a
 * streamer's plan, see platform totals. Authenticated with JOKKO_ADMIN_TOKEN,
 * kept only for this browser tab (sessionStorage). */

const root = document.getElementById("jokko-app")!;
const TOKEN_KEY = "jokko:admin-token";

function getToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}
function setToken(token: string) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: the token lives in memory for this page only */
  }
  memoryToken = token;
}
let memoryToken = getToken();

const adminApi = <T = any>(method: string, path: string, body?: unknown) => api<T>(method, path, body, { Authorization: `Bearer ${memoryToken}` });

function header(right: Node[] = []) {
  return el("header", {
    class: "jk-topbar",
    children: [
      el("a", { class: "jk-brand", attrs: { href: "/admin" }, children: [el("img", { attrs: { src: "/assets/jokko/jokko-mark.svg", alt: "" } }), el("span", { text: "Jokko · Admin" })] }),
      el("div", { class: "jk-row", children: right }),
    ],
  });
}

function renderLogin(error?: string) {
  const token = input({ type: "password", autocomplete: "off", placeholder: "JOKKO_ADMIN_TOKEN" });
  const submit = el("button", { class: "jk-btn jk-btn--primary jk-btn--block", text: "Ouvrir la console", attrs: { type: "submit" } });
  const form = el("form", {
    class: "jk-stack",
    children: [
      el("p", { class: "jk-muted jk-small", text: "Jeton défini dans la variable d'environnement JOKKO_ADMIN_TOKEN du serveur. Il reste seulement dans cet onglet." }),
      field("Jeton administrateur", token),
      error ? banner("error", error) : null,
      submit,
    ],
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    setToken(token.value.trim());
    void load();
  });
  root.replaceChildren(header(), el("main", { class: "jk-auth jk-auth--single", children: [el("section", { class: "jk-card jk-auth__card jk-stack", children: [el("h2", { class: "jk-card__title", text: "Console d'administration" }), form] })] }));
  token.focus();
}

function stat(label: string, value: string, sub?: string) {
  return el("div", { class: "jk-card jk-stat", children: [el("span", { class: "jk-stat__label", text: label }), el("strong", { class: "jk-stat__value", text: value }), sub ? el("span", { class: "jk-muted jk-small", text: sub }) : null] });
}

function table(head: string[], rows: HTMLTableRowElement[], empty: string) {
  if (!rows.length) return el("p", { class: "jk-muted jk-empty", text: empty });
  return el("div", {
    class: "jk-table-wrap",
    children: [el("table", { class: "jk-table", children: [el("thead", { children: [el("tr", { children: head.map((h) => el("th", { text: h, attrs: { scope: "col" } })) })] }), el("tbody", { children: rows })] })],
  });
}

const td = (label: string, content: string | Node, cls = "") =>
  el("td", { class: cls, attrs: { "data-label": label }, ...(typeof content === "string" ? { text: content } : { children: [content] }) });

async function load() {
  if (!memoryToken) return renderLogin();
  let stats: any, withdrawals: any, streamers: any;
  try {
    [stats, withdrawals, streamers] = await Promise.all([
      adminApi("GET", "/api/admin/stats"),
      adminApi("GET", "/api/admin/withdrawals"),
      adminApi("GET", "/api/admin/streamers"),
    ]);
  } catch (err) {
    setToken("");
    return renderLogin(err instanceof ApiError ? err.message : "Erreur inattendue.");
  }

  const process = (w: any, status: "paid" | "rejected") => async () => {
    const note = prompt(status === "paid" ? `Référence du virement Wave de ${fcfa(w.amount)} vers ${w.phone} :` : "Motif du refus (visible par le streamer) :", "");
    if (note === null) return;
    try {
      await adminApi("POST", `/api/admin/withdrawals/${encodeURIComponent(w.id)}`, { status, note });
      toast(status === "paid" ? "Retrait marqué versé" : "Retrait refusé, solde libéré");
      await load();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Erreur inattendue.");
    }
  };

  const wRows = (withdrawals.withdrawals as any[])
    .sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending") || a.createdAt - b.createdAt)
    .map((w) =>
      el("tr", {
        children: [
          td("Demandé", dateTime(w.createdAt)),
          td("Streamer", w.streamer ?? "?"),
          td("Montant", fcfa(w.amount), "jk-num"),
          td("Numéro Wave", el("code", { text: w.phone })),
          td("Statut", el("span", { class: `jk-status jk-status--${w.status}`, text: STATUS_LABELS[w.status] ?? w.status })),
          td(
            "Action",
            w.status === "pending"
              ? el("div", { class: "jk-row", children: [button("Versé", "jk-btn--sm jk-btn--primary", process(w, "paid")), button("Refuser", "jk-btn--sm jk-btn--danger", process(w, "rejected"))] })
              : el("span", { class: "jk-muted jk-small", text: w.note || "—" })
          ),
        ],
      })
    );

  const sRows = (streamers.streamers as any[]).map((s) =>
    el("tr", {
      children: [
        td("Streamer", el("div", { children: [el("strong", { text: s.displayName }), el("div", { class: "jk-muted jk-small", text: `/s/${s.slug} · ${s.email}` })] })),
        td("Inscrit", dateTime(s.createdAt)),
        td("Reçu", fcfa(s.received), "jk-num"),
        td("Solde", fcfa(s.available), "jk-num"),
        td(
          "Offre",
          button(s.plan === "pro" ? "Pro → Gratuit" : "Gratuit → Pro", `jk-btn--sm ${s.plan === "pro" ? "" : "jk-btn--primary"}`, async () => {
            await adminApi("POST", `/api/admin/streamers/${encodeURIComponent(s.slug)}/plan`, { plan: s.plan === "pro" ? "free" : "pro" });
            toast("Offre mise à jour");
            await load();
          })
        ),
      ],
    })
  );

  root.replaceChildren(
    header([
      el("span", { class: `jk-badge ${stats.livemode ? "jk-badge--live" : "jk-badge--test"}`, text: stats.livemode ? "Argent réel" : "Mode test" }),
      button("Fermer", "jk-btn--sm jk-btn--ghost", () => {
        setToken("");
        renderLogin();
      }),
    ]),
    el("main", {
      class: "jk-main",
      children: [
        el("h1", { text: "Console Jokko" }),
        el("div", {
          class: "jk-stats",
          children: [
            stat("Retraits à traiter", String(stats.pendingWithdrawals.count), fcfa(stats.pendingWithdrawals.amount)),
            stat("Volume confirmé", fcfa(stats.volume), `${stats.payments} soutiens`),
            stat("Commission Jokko", fcfa(stats.commission)),
            stat("Streamers", String(stats.streamers), `${stats.pro} en Pro · ${stats.fans} fans classés`),
          ],
        }),
        el("section", {
          class: "jk-card",
          children: [
            el("h2", { class: "jk-card__title", text: "Retraits" }),
            el("p", { class: "jk-muted jk-small", text: "Fais le virement depuis le compte Wave Business de Jokko, puis clique « Versé » avec la référence. « Refuser » rend le montant disponible au streamer." }),
            table(["Demandé", "Streamer", "Montant", "Numéro Wave", "Statut", "Action"], wRows, "Aucune demande de retrait."),
          ],
        }),
        el("section", { class: "jk-card", children: [el("h2", { class: "jk-card__title", text: "Streamers" }), table(["Streamer", "Inscrit", "Reçu", "Solde", "Offre"], sRows, "Aucun streamer inscrit.")] }),
      ],
    })
  );
}

void load();
