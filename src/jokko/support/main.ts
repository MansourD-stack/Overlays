import "../jokko.css";
import "./support.css";
import { applyTheme, isThemeName } from "@/themes";
import { api, ApiError } from "../api";
import { fcfa, initials } from "../format";
import { banner, el, progress } from "../ui";

/* Fan support page (/s/<slug>): pick an amount + Wave / Orange Money / Free
 * Money, pay on the provider's page, come back here and see the confirmation
 * (and your Rang Teranga) within seconds. Mobile-first, no framework, no web font. */

interface Rank {
  id: string;
  label: string;
  min: number;
}
interface PublicStreamer {
  displayName: string;
  slug: string;
  theme: string;
  page: { title: string; message: string; suggestedAmounts: number[] };
  goal: { label: string; target: number; current: number };
  methods: { id: string; label: string }[];
  minAmount: number;
  maxAmount: number;
  testMode: boolean;
  ranks: Rank[];
}

const root = document.getElementById("jokko-app")!;
const slug = decodeURIComponent(location.pathname.split("/")[2] ?? "");
const params = new URLSearchParams(location.search);

function footer() {
  return el("footer", {
    class: "jk-support__footer",
    children: [
      el("span", { text: "Paiement sécurisé via un agrégateur agréé · " }),
      el("a", { attrs: { href: "/dashboard" }, children: [el("img", { attrs: { src: "/assets/jokko/jokko-mark.svg", alt: "" } }), el("span", { text: "Propulsé par Jokko" })] }),
    ],
  });
}

function hero(s: PublicStreamer) {
  return el("header", {
    class: "jk-support__hero",
    children: [
      el("div", { class: "jk-support__avatar", attrs: { "aria-hidden": "true" }, text: initials(s.displayName) }),
      el("p", { class: "jk-support__name", text: s.displayName }),
      el("h1", { text: s.page.title }),
      s.page.message ? el("p", { class: "jk-support__message", text: s.page.message }) : null,
      el("div", {
        class: "jk-support__goal",
        children: [el("div", { class: "jk-row jk-support__goal-head", children: [el("span", { text: s.goal.label }), el("strong", { text: `${fcfa(s.goal.current)} / ${fcfa(s.goal.target)}` })] }), progress(s.goal.current, s.goal.target)],
      }),
    ],
  });
}

function renderForm(s: PublicStreamer) {
  let amount = s.page.suggestedAmounts[1] ?? s.page.suggestedAmounts[0] ?? 1000;
  let method = "";
  const errors = el("div");

  const custom = el("input", { class: "jk-input", attrs: { type: "number", inputmode: "numeric", min: String(s.minAmount), max: String(s.maxAmount), step: "1", placeholder: "Autre montant", "aria-label": "Autre montant en F CFA" } });
  const chips = s.page.suggestedAmounts.map((a) => {
    const chip = el("button", { class: "jk-chip", text: fcfa(a), attrs: { type: "button", "aria-pressed": String(a === amount) } });
    chip.addEventListener("click", () => {
      amount = a;
      custom.value = "";
      sync();
    });
    return chip;
  });
  custom.addEventListener("input", () => {
    amount = Math.floor(Number(custom.value)) || 0;
    sync();
  });

  const methods = s.methods.map((m) => {
    const btn = el("button", {
      class: `jk-method jk-method--${m.id}`,
      attrs: { type: "button", "aria-pressed": "false" },
      children: [el("span", { class: "jk-method__dot", attrs: { "aria-hidden": "true" } }), el("span", { text: m.label })],
    });
    btn.addEventListener("click", () => {
      method = m.id;
      sync();
    });
    return btn;
  });

  const name = el("input", { class: "jk-input", attrs: { type: "text", maxlength: "32", placeholder: "Anonyme", autocomplete: "nickname" } });
  const phone = el("input", { class: "jk-input", attrs: { type: "tel", inputmode: "tel", placeholder: "77 123 45 67", autocomplete: "tel" } });
  const message = el("textarea", { class: "jk-input", attrs: { maxlength: "140", rows: "2", placeholder: "Un mot pour le stream (facultatif)" } });
  const counter = el("small", { class: "jk-muted", text: "0 / 140" });
  message.addEventListener("input", () => (counter.textContent = `${message.value.length} / 140`));

  const pay = el("button", { class: "jk-btn jk-btn--primary jk-btn--block jk-support__pay", attrs: { type: "submit" } });

  function sync() {
    chips.forEach((c, i) => c.setAttribute("aria-pressed", String(!custom.value && s.page.suggestedAmounts[i] === amount)));
    methods.forEach((b, i) => b.setAttribute("aria-pressed", String(s.methods[i].id === method)));
    const valid = amount >= s.minAmount && amount <= s.maxAmount;
    pay.textContent = !method ? "Choisis un moyen de paiement" : valid ? `Soutenir avec ${fcfa(amount)}` : `Montant entre ${fcfa(s.minAmount)} et ${fcfa(s.maxAmount)}`;
    pay.disabled = !method || !valid;
  }
  sync();

  const form = el("form", {
    class: "jk-support__form jk-stack",
    children: [
      el("fieldset", { class: "jk-fieldset", children: [el("legend", { text: "1. Montant (F CFA)" }), el("div", { class: "jk-chips", children: chips }), custom] }),
      el("fieldset", { class: "jk-fieldset", children: [el("legend", { text: "2. Payer avec" }), el("div", { class: "jk-methods", children: methods })] }),
      el("details", {
        class: "jk-support__more",
        children: [
          el("summary", { text: "Ajouter mon nom, un message, gagner mon Rang Teranga" }),
          el("div", {
            class: "jk-stack",
            children: [
              el("label", { class: "jk-field", children: [el("span", { text: "Ton pseudo (affiché sur le stream)" }), name] }),
              el("label", { class: "jk-field", children: [el("span", { text: "Ton message" }), message, counter] }),
              el("label", {
                class: "jk-field",
                children: [
                  el("span", { text: "Ton numéro (facultatif)" }),
                  phone,
                  el("small", { text: "Sert uniquement à calculer ton Rang Teranga (Bronze → Diamant), valable chez tous les streamers Jokko. Il n'est jamais affiché ni stocké en clair." }),
                ],
              }),
            ],
          }),
        ],
      }),
      errors,
      pay,
    ],
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    pay.disabled = true;
    pay.textContent = "Redirection vers le paiement…";
    errors.replaceChildren();
    try {
      const r = await api<{ ref: string; redirectUrl: string }>("POST", `/api/public/streamers/${encodeURIComponent(s.slug)}/payments`, {
        amount,
        method,
        name: name.value,
        message: message.value,
        phone: phone.value,
      });
      location.href = r.redirectUrl;
    } catch (err) {
      errors.replaceChildren(banner("error", err instanceof ApiError ? err.message : "Erreur inattendue."));
      sync();
    }
  });

  root.replaceChildren(
    el("main", {
      class: "jk-support",
      children: [s.testMode ? banner("test", "Mode test : aucun argent réel ne sera prélevé.") : null, hero(s), form, footer()],
    })
  );
}

async function renderStatus(s: PublicStreamer, ref: string) {
  const box = el("section", { class: "jk-card jk-support__status", attrs: { "aria-live": "polite" } });
  root.replaceChildren(el("main", { class: "jk-support", children: [hero(s), box, footer()] }));

  const again = () => {
    const a = el("a", { class: "jk-btn jk-btn--block", text: "Faire un autre soutien", attrs: { href: `/s/${encodeURIComponent(s.slug)}` } });
    return a;
  };

  const started = Date.now();
  for (;;) {
    let p: any;
    try {
      p = await api("GET", `/api/public/payments/${encodeURIComponent(ref)}`);
    } catch (err) {
      box.replaceChildren(banner("error", err instanceof ApiError ? err.message : "Paiement introuvable."), again());
      return;
    }
    if (p.status === "completed") {
      const fan = p.fan;
      box.replaceChildren(
        el("div", { class: "jk-support__check", text: "✓", attrs: { "aria-hidden": "true" } }),
        el("h2", { text: `Jërëjëf ${p.fanName} !` }),
        el("p", { text: `Ton soutien de ${fcfa(p.amount)} via ${p.methodLabel} est confirmé. Il s'affiche en direct sur le stream de ${s.displayName}.` }),
        ...(fan
          ? [el("div", {
              class: "jk-support__rank",
              children: [
                el("span", { class: "jk-muted jk-small", text: "Ton Rang Teranga" }),
                el("span", { class: `jk-rank jk-rank--${fan.rank.id} jk-support__rank-badge`, text: fan.rank.label }),
                el("span", { class: "jk-muted jk-small", text: `${fcfa(fan.total)} de soutien chez ${fan.streamers} streamer${fan.streamers > 1 ? "s" : ""} Jokko` }),
                fan.next ? el("span", { class: "jk-small", text: `Plus que ${fcfa(fan.next.missing)} pour le rang ${fan.next.rank.label}.` }) : el("span", { class: "jk-small", text: "Rang maximal atteint. Légende." }),
              ],
            })]
          : []),
        again()
      );
      return;
    }
    if (p.status === "failed" || p.status === "cancelled" || params.has("cancelled")) {
      box.replaceChildren(
        el("h2", { text: p.status === "failed" ? "Le paiement n'a pas abouti" : "Paiement annulé" }),
        el("p", { class: "jk-muted", text: "Aucun montant n'a été débité par Jokko. Tu peux réessayer." }),
        again()
      );
      return;
    }
    const waited = Date.now() - started;
    box.replaceChildren(
      el("div", { class: "jk-spinner", attrs: { role: "progressbar", "aria-label": "Confirmation en cours" } }),
      el("h2", { text: "Confirmation en cours…" }),
      el("p", { class: "jk-muted", text: waited > 20_000 ? "Si tu as validé sur ton téléphone, la confirmation arrive. Tu peux laisser cette page ouverte." : "Valide le paiement sur ton téléphone si ce n'est pas déjà fait." })
    );
    if (waited > 5 * 60_000) {
      box.append(again());
      return;
    }
    await new Promise((r) => setTimeout(r, waited < 30_000 ? 1500 : 5000));
  }
}

async function boot() {
  try {
    const s = await api<PublicStreamer>("GET", `/api/public/streamers/${encodeURIComponent(slug)}`);
    if (isThemeName(s.theme)) applyTheme(s.theme);
    document.title = `${s.page.title} · Jokko`;
    const ref = params.get("ref");
    if (ref) await renderStatus(s, ref);
    else renderForm(s);
  } catch (err) {
    root.replaceChildren(
      el("main", {
        class: "jk-support",
        children: [el("section", { class: "jk-card jk-support__status", children: [el("h1", { text: "Page introuvable" }), el("p", { class: "jk-muted", text: err instanceof ApiError ? err.message : "Erreur inattendue." })] }), footer()],
      })
    );
  }
}

void boot();
