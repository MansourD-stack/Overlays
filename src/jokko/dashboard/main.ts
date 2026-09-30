import "../jokko.css";
import "./dashboard.css";
import { api, ApiError } from "../api";
import { STATUS_LABELS, copyText, dateTime, fcfa } from "../format";
import { banner, button, el, field, input, progress, toast } from "../ui";

/* Streamer dashboard: sign-up/login, onboarding in 3 steps (overlay → test
 * alert → share link), payment history, balance, Wave payout number,
 * withdrawal requests and all settings. Vanilla TS, no framework. */

const THEME_LABELS: Record<string, string> = {
  "dakar-neon": "Dakar Neon",
  "flaas-fire": "Teranga Fire",
  "atlantic-cyber": "Atlantic Cyber",
  tournament: "Tournament",
  "night-mode": "Night Mode",
};

const root = document.getElementById("jokko-app")!;
let refreshTimer: number | undefined;

function header(right: Node[] = []) {
  return el("header", {
    class: "jk-topbar",
    children: [
      el("a", { class: "jk-brand", attrs: { href: "/dashboard" }, children: [el("img", { attrs: { src: "/assets/jokko/jokko-mark.svg", alt: "" } }), el("span", { text: "Jokko" })] }),
      el("div", { class: "jk-row", children: right }),
    ],
  });
}

function showError(target: HTMLElement, err: unknown) {
  target.replaceChildren(banner("error", err instanceof ApiError ? err.message : "Erreur inattendue."));
}

// ───────────────────────── Auth ─────────────────────────

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

function renderAuth(mode: "signup" | "login" = "signup") {
  window.clearInterval(refreshTimer);
  const errors = el("div");
  const email = input({ type: "email", autocomplete: "email", required: "", placeholder: "toi@exemple.sn" });
  const password = input({ type: "password", autocomplete: mode === "signup" ? "new-password" : "current-password", minlength: "8", required: "" });
  const name = input({ type: "text", maxlength: "40", placeholder: "Ex. Awa Gaming", autocomplete: "nickname" });
  const slug = input({ type: "text", maxlength: "30", placeholder: "awa-gaming", autocapitalize: "off", spellcheck: "false" });
  const preview = el("small", { class: "jk-muted" });
  let slugTouched = false;
  const updatePreview = () => (preview.textContent = `Ton lien de soutien : ${location.host}/s/${slug.value || "…"}`);
  name.addEventListener("input", () => {
    if (!slugTouched) slug.value = slugify(name.value);
    updatePreview();
  });
  slug.addEventListener("input", () => {
    slugTouched = true;
    slug.value = slugify(slug.value);
    updatePreview();
  });
  updatePreview();

  const form = el("form", {
    class: "jk-stack",
    children:
      mode === "signup"
        ? [field("Nom de streamer", name), el("div", { class: "jk-field", children: [field("Identifiant", slug), preview] }), field("E-mail", email), field("Mot de passe", password, "8 caractères minimum.")]
        : [field("E-mail", email), field("Mot de passe", password)],
  });
  const submit = el("button", { class: "jk-btn jk-btn--primary jk-btn--block", text: mode === "signup" ? "Créer mon compte gratuit" : "Se connecter", attrs: { type: "submit" } });
  form.append(errors, submit);
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    submit.disabled = true;
    try {
      if (mode === "signup") await api("POST", "/api/auth/signup", { displayName: name.value, slug: slug.value, email: email.value, password: password.value });
      else await api("POST", "/api/auth/login", { email: email.value, password: password.value });
      await loadDashboard();
    } catch (err) {
      showError(errors, err);
    } finally {
      submit.disabled = false;
    }
  });

  const switcher = el("p", { class: "jk-muted jk-small", attrs: { style: "text-align:center" } });
  const link = el("a", { text: mode === "signup" ? "J'ai déjà un compte" : "Créer un compte", attrs: { href: "#" } });
  link.addEventListener("click", (e) => {
    e.preventDefault();
    renderAuth(mode === "signup" ? "login" : "signup");
  });
  switcher.append(link);

  root.replaceChildren(
    header(),
    el("main", {
      class: "jk-auth",
      children: [
        el("section", {
          class: "jk-auth__pitch",
          children: [
            el("h1", { text: "Ton identité de live. Tes soutiens en Wave, Orange Money et Free Money." }),
            el("p", { class: "jk-muted", text: "Un overlay de marque pour OBS et TikTok LIVE Studio, une page de soutien à partager en bio, et chaque don s'affiche en direct sur ton stream." }),
            el("ul", {
              class: "jk-auth__points",
              children: ["Prêt en moins de 15 minutes", "Alerte à l'écran dès que le paiement est confirmé", "Rang Teranga : tes fans gagnent en prestige partout sur Jokko"].map((t) => el("li", { text: t })),
            }),
          ],
        }),
        el("section", { class: "jk-card jk-auth__card", children: [el("h2", { class: "jk-card__title", text: mode === "signup" ? "Créer mon compte" : "Connexion" }), form, switcher] }),
      ],
    })
  );
  (mode === "signup" ? name : email).focus();
}

// ───────────────────────── Dashboard ─────────────────────────

interface Dashboard {
  streamer: any;
  balance: { received: number; net: number; commission: number; count: number; withdrawn: number; pendingWithdrawals: number; available: number };
  goal: { label: string; target: number; current: number };
  payments: any[];
  withdrawals: any[];
  overlay: { key: string; urls: Record<string, string> };
  supportUrl: string;
  themes: { id: string; available: boolean }[];
  commissionRate: number;
  limits: { minAmount: number; maxAmount: number; minWithdrawal: number };
  testMode: boolean;
  provider: string;
}

async function loadDashboard() {
  try {
    const data = await api<Dashboard>("GET", "/api/dashboard");
    renderDashboard(data);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) renderAuth(new URLSearchParams(location.search).has("login") ? "login" : "signup");
    else root.replaceChildren(header(), el("main", { class: "jk-main", children: [banner("error", err instanceof ApiError ? err.message : "Erreur inattendue.")] }));
  }
}

function copyRow(label: string, value: string, hint?: string) {
  const code = el("code", { class: "jk-copy__value", text: value });
  return el("div", {
    class: "jk-copy",
    children: [
      el("div", { class: "jk-copy__text", children: [el("span", { class: "jk-copy__label", text: label }), code, hint ? el("small", { class: "jk-muted", text: hint }) : null] }),
      button("Copier", "jk-btn--sm", async () => toast((await copyText(value)) ? "Copié ✓" : "Copie impossible — sélectionne le texte")),
    ],
  });
}

function stat(label: string, value: string, sub?: string) {
  return el("div", { class: "jk-card jk-stat", children: [el("span", { class: "jk-stat__label", text: label }), el("strong", { class: "jk-stat__value", text: value }), sub ? el("span", { class: "jk-muted jk-small", text: sub }) : null] });
}

const DONE_KEY = "jokko:onboarding";
function doneSteps(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(DONE_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function markDone(step: string) {
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify({ ...doneSteps(), [step]: true }));
  } catch {
    /* storage unavailable */
  }
}

function onboarding(d: Dashboard, rerender: () => void) {
  const done: Record<string, boolean> = { ...doneSteps(), paid: d.balance.count > 0 };
  const step = (id: string, n: number, title: string, body: Node[]) =>
    el("li", {
      class: `jk-step ${done[id] ? "jk-step--done" : ""}`,
      children: [el("span", { class: "jk-step__num", text: done[id] ? "✓" : String(n) }), el("div", { class: "jk-stack jk-step__body", children: [el("strong", { text: title }), ...body] })],
    });
  const allDone = done.overlay && done.test && done.share;
  if (allDone) return null;
  return el("section", {
    class: "jk-card",
    children: [
      el("h2", { class: "jk-card__title", text: "Démarrer en 3 étapes" }),
      el("ol", {
        class: "jk-steps",
        children: [
          step("overlay", 1, "Ajoute l'overlay comme Browser Source", [
            el("p", { class: "jk-muted jk-small", text: "OBS : Sources → + → Navigateur, largeur 1920, hauteur 1080. TikTok LIVE Studio : Ajouter une source → Lien, 1080 × 1920." }),
            copyRow("Twitch / YouTube (16:9)", d.overlay.urls.twitchGameplay),
            copyRow("TikTok LIVE (9:16)", d.overlay.urls.tiktokGameplay),
            button("C'est fait", "jk-btn--sm", () => {
              markDone("overlay");
              rerender();
            }),
          ]),
          step("test", 2, "Envoie une alerte de test", [
            el("p", { class: "jk-muted jk-small", text: "Elle s'affiche sur l'overlay ouvert, sans argent réel ni enregistrement." }),
            button("Envoyer une alerte de test", "jk-btn--primary jk-btn--sm", async () => {
              await api("POST", "/api/overlay/test-alert", {});
              markDone("test");
              toast("Alerte envoyée — regarde ton overlay");
              rerender();
            }),
          ]),
          step("share", 3, "Partage ton lien de soutien", [
            el("p", { class: "jk-muted jk-small", text: "Mets-le dans ta bio TikTok, ton panneau Twitch et ton chat." }),
            copyRow("Lien de soutien", d.supportUrl),
            button("C'est fait", "jk-btn--sm", () => {
              markDone("share");
              rerender();
            }),
          ]),
        ],
      }),
    ],
  });
}

function paymentsTable(d: Dashboard) {
  if (!d.payments.length) {
    return el("div", { class: "jk-empty", children: [el("p", { text: "Aucun paiement pour l'instant." }), el("p", { class: "jk-muted jk-small", text: "Partage ton lien de soutien : chaque don confirmé apparaît ici et sur ton overlay." })] });
  }
  const rows = d.payments.map((p) =>
    el("tr", {
      children: [
        el("td", { attrs: { "data-label": "Date" }, text: dateTime(p.createdAt) }),
        el("td", {
          attrs: { "data-label": "Fan" },
          children: [
            el("div", { class: "jk-row", children: [el("strong", { text: p.fanName }), p.rank ? el("span", { class: `jk-rank jk-rank--${p.rank.toLowerCase()}`, text: p.rank }) : null] }),
            p.fanMessage ? el("div", { class: "jk-muted jk-small jk-msg", text: p.fanMessage }) : null,
          ],
        }),
        el("td", { attrs: { "data-label": "Moyen" }, text: p.methodLabel }),
        el("td", { attrs: { "data-label": "Montant" }, class: "jk-num", text: fcfa(p.amount) }),
        el("td", { attrs: { "data-label": "Net" }, class: "jk-num", text: p.status === "completed" ? fcfa(p.net) : "—" }),
        el("td", { attrs: { "data-label": "Statut" }, children: [el("span", { class: `jk-status jk-status--${p.status}`, text: STATUS_LABELS[p.status] ?? p.status })] }),
      ],
    })
  );
  return el("div", {
    class: "jk-table-wrap",
    children: [
      el("table", {
        class: "jk-table",
        children: [
          el("thead", { children: [el("tr", { children: ["Date", "Fan", "Moyen", "Montant", "Net", "Statut"].map((h) => el("th", { text: h, attrs: { scope: "col" } })) })] }),
          el("tbody", { children: rows }),
        ],
      }),
    ],
  });
}

function payoutCard(d: Dashboard, reload: () => void) {
  const s = d.streamer;
  const errors = el("div");
  const phone = input({ type: "tel", inputmode: "tel", autocomplete: "tel", placeholder: "77 123 45 67" }, s.payout.phone ?? "");
  const amount = input({ type: "number", inputmode: "numeric", min: String(d.limits.minWithdrawal), step: "1", placeholder: String(d.balance.available) });
  const list = d.withdrawals.length
    ? el("ul", {
        class: "jk-list",
        children: d.withdrawals.slice(0, 5).map((w) =>
          el("li", { children: [el("span", { text: `${fcfa(w.amount)} → ${w.phone}` }), el("span", { class: `jk-status jk-status--${w.status}`, text: STATUS_LABELS[w.status] ?? w.status })] })
        ),
      })
    : null;
  return el("section", {
    class: "jk-card jk-stack",
    children: [
      el("h2", { class: "jk-card__title", text: "Retraits Wave" }),
      field("Numéro Wave de retrait", phone, s.payout.phone ? `Connecté : ${s.payout.masked}` : "Le numéro de ton compte Wave. Les retraits y sont versés."),
      button(s.payout.phone ? "Mettre à jour le numéro" : "Connecter mon compte Wave", "jk-btn--sm", async () => {
        try {
          await api("PUT", "/api/payout", { phone: phone.value });
          toast("Numéro Wave enregistré");
          reload();
        } catch (err) {
          showError(errors, err);
        }
      }),
      field(`Montant à retirer (min. ${fcfa(d.limits.minWithdrawal)})`, amount),
      button("Demander un retrait", "jk-btn--primary", async () => {
        try {
          await api("POST", "/api/withdrawals", { amount: Number(amount.value) });
          toast("Demande de retrait envoyée");
          reload();
        } catch (err) {
          showError(errors, err);
        }
      }),
      errors,
      d.testMode ? el("p", { class: "jk-muted jk-small", text: "Mode test : les retraits sont enregistrés mais aucun argent réel n'est versé." }) : null,
      list,
    ],
  });
}

function overlayCard(d: Dashboard, reload: () => void) {
  return el("section", {
    class: "jk-card jk-stack",
    children: [
      el("h2", { class: "jk-card__title", text: "Overlay & scènes" }),
      copyRow("Gameplay — Twitch/YouTube 1920×1080", d.overlay.urls.twitchGameplay),
      copyRow("Starting Soon — 1920×1080", d.overlay.urls.twitchStartingSoon),
      copyRow("BRB — 1920×1080", d.overlay.urls.twitchBrb),
      copyRow("Gameplay — TikTok LIVE 1080×1920", d.overlay.urls.tiktokGameplay),
      copyRow("Starting Soon — TikTok 1080×1920", d.overlay.urls.tiktokStartingSoon),
      el("p", { class: "jk-muted jk-small", text: "Ces liens contiennent ta clé d'overlay (lecture seule). Si un lien a fuité, régénère la clé puis remplace-le dans OBS." }),
      el("div", {
        class: "jk-row",
        children: [
          button("Alerte de test", "jk-btn--sm", async () => {
            await api("POST", "/api/overlay/test-alert", {});
            toast("Alerte envoyée");
          }),
          el("a", { class: "jk-btn jk-btn--sm", text: "Panneau de contrôle ↗", attrs: { href: "/control", target: "_blank", rel: "noopener" } }),
          button("Régénérer la clé", "jk-btn--sm jk-btn--danger", async () => {
            if (!confirm("Les anciens liens d'overlay cesseront de fonctionner. Continuer ?")) return;
            await api("POST", "/api/overlay/rotate-key", {});
            toast("Nouvelle clé générée");
            reload();
          }),
        ],
      }),
    ],
  });
}

function settingsCard(d: Dashboard, reload: () => void) {
  const s = d.streamer;
  const errors = el("div");
  const displayName = input({ type: "text", maxlength: "40" }, s.displayName);
  const community = input({ type: "text", maxlength: "40" }, s.communityName);
  const title = input({ type: "text", maxlength: "60" }, s.page.title);
  const message = el("textarea", { class: "jk-input", attrs: { maxlength: "280", rows: "3" } });
  message.value = s.page.message;
  const amounts = input({ type: "text", inputmode: "numeric" }, s.page.suggestedAmounts.join(", "));
  const goalLabel = input({ type: "text", maxlength: "30" }, s.goal.label);
  const goalTarget = input({ type: "number", min: "1000", step: "500" }, String(s.goal.target));
  const theme = el("select", {
    class: "jk-input",
    children: d.themes.map((t) => {
      const o = el("option", { text: `${THEME_LABELS[t.id] ?? t.id}${t.available ? "" : " — Pro"}`, attrs: { value: t.id } });
      o.disabled = !t.available;
      o.selected = t.id === s.theme;
      return o;
    }),
  });
  const showMessages = el("input", { attrs: { type: "checkbox" } });
  showMessages.checked = s.showMessages;
  const blocked = input({ type: "text", placeholder: "mots séparés par des virgules" }, s.blockedWords.join(", "));
  const resetGoal = el("input", { attrs: { type: "checkbox" } });

  const save = button("Enregistrer", "jk-btn--primary", async () => {
    try {
      await api("PATCH", "/api/settings", {
        displayName: displayName.value,
        communityName: community.value,
        theme: theme.value,
        page: { title: title.value, message: message.value, suggestedAmounts: amounts.value.split(/[,;\s]+/).filter(Boolean).map(Number) },
        goal: { label: goalLabel.value, target: Number(goalTarget.value), reset: resetGoal.checked },
        showMessages: showMessages.checked,
        blockedWords: blocked.value.split(",").map((w) => w.trim()).filter(Boolean),
      });
      toast("Réglages enregistrés — overlay mis à jour");
      reload();
    } catch (err) {
      showError(errors, err);
    }
  });

  return el("section", {
    class: "jk-card jk-stack",
    children: [
      el("h2", { class: "jk-card__title", text: "Réglages" }),
      el("h3", { class: "jk-subtitle", text: "Identité" }),
      el("div", { class: "jk-grid-2", children: [field("Nom affiché", displayName), field("Nom de ta communauté", community, "« Bienvenue dans la … » sur les alertes.")] }),
      field("Thème de l'overlay et de ta page", theme, s.plan === "pro" ? undefined : "Offre Gratuite : Dakar Neon. Les 5 thèmes sont inclus dans l'offre Pro."),
      el("h3", { class: "jk-subtitle", text: "Page de soutien" }),
      field("Titre", title),
      field("Message aux fans", message),
      field("Montants suggérés (F CFA)", amounts, `4 montants max, entre ${fcfa(d.limits.minAmount)} et ${fcfa(d.limits.maxAmount)}.`),
      el("h3", { class: "jk-subtitle", text: "Objectif de dons" }),
      el("div", { class: "jk-grid-2", children: [field("Intitulé", goalLabel), field("Objectif (F CFA)", goalTarget)] }),
      el("label", { class: "jk-check", children: [resetGoal, el("span", { text: "Remettre la jauge à zéro (nouvel objectif)" })] }),
      el("h3", { class: "jk-subtitle", text: "Modération" }),
      el("label", { class: "jk-check", children: [showMessages, el("span", { text: "Afficher les messages des fans sur le stream" })] }),
      field("Mots bloqués", blocked, "Liens et insultes courantes sont déjà filtrés automatiquement."),
      errors,
      save,
    ],
  });
}

function renderDashboard(d: Dashboard) {
  const s = d.streamer;
  const reload = () => void loadDashboard();
  const rerender = () => renderDashboard(d);
  const logout = button("Déconnexion", "jk-btn--sm jk-btn--ghost", async () => {
    await api("POST", "/api/auth/logout", {});
    renderAuth("login");
  });

  root.replaceChildren(
    header([
      d.testMode ? el("span", { class: "jk-badge jk-badge--test", text: "Mode test" }) : el("span", { class: "jk-badge jk-badge--live", text: "Paiements réels" }),
      el("span", { class: `jk-badge ${s.plan === "pro" ? "jk-badge--pro" : ""}`, text: s.plan === "pro" ? "Pro" : "Gratuit" }),
      logout,
    ]),
    el("main", {
      class: "jk-main",
      children: [
        el("div", {
          class: "jk-hello",
          children: [
            el("div", { children: [el("h1", { text: `Salut ${s.displayName} 👋` }), el("p", { class: "jk-muted", text: `Commission Jokko : ${Math.round(d.commissionRate * 100)} % par don (frais de paiement inclus).` })] }),
            el("a", { class: "jk-btn", text: "Voir ma page de soutien ↗", attrs: { href: d.supportUrl, target: "_blank", rel: "noopener" } }),
          ],
        }),
        d.testMode ? banner("test", "Mode test : les paiements passent par le simulateur Jokko, aucun argent réel ne circule. Configure PayDunya (voir docs/JOKKO_PAIEMENTS.md) pour passer en réel.") : null,
        onboarding(d, rerender),
        el("div", {
          class: "jk-stats",
          children: [
            stat("Solde disponible", fcfa(d.balance.available), d.balance.pendingWithdrawals ? `${fcfa(d.balance.pendingWithdrawals)} en cours de retrait` : undefined),
            stat("Reçu (net)", fcfa(d.balance.net), `${fcfa(d.balance.received)} brut · ${fcfa(d.balance.commission)} commission`),
            stat("Soutiens confirmés", String(d.balance.count)),
            el("div", {
              class: "jk-card jk-stat",
              children: [el("span", { class: "jk-stat__label", text: d.goal.label }), el("strong", { class: "jk-stat__value", text: `${fcfa(d.goal.current)} / ${fcfa(d.goal.target)}` }), progress(d.goal.current, d.goal.target)],
            }),
          ],
        }),
        el("div", {
          class: "jk-layout",
          children: [
            el("div", {
              class: "jk-stack",
              children: [
                el("section", { class: "jk-card", children: [el("h2", { class: "jk-card__title", children: [el("span", { text: "Historique des paiements" }), el("span", { class: "jk-muted jk-small", text: "actualisé toutes les 10 s" })] }), paymentsTable(d)] }),
                settingsCard(d, reload),
              ],
            }),
            el("div", { class: "jk-stack", children: [payoutCard(d, reload), overlayCard(d, reload), el("section", { class: "jk-card jk-stack", children: [el("h2", { class: "jk-card__title", text: "Lien de soutien" }), copyRow("À mettre en bio", d.supportUrl)] })] }),
          ],
        }),
      ],
    })
  );

  // Refresh history/balance quietly, but never while the streamer is typing in a form.
  window.clearInterval(refreshTimer);
  refreshTimer = window.setInterval(async () => {
    const active = document.activeElement;
    if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) return;
    try {
      const next = await api<Dashboard>("GET", "/api/dashboard");
      if (JSON.stringify(next.payments) !== JSON.stringify(d.payments) || JSON.stringify(next.balance) !== JSON.stringify(d.balance)) renderDashboard(next);
    } catch {
      /* transient — try again next tick */
    }
  }, 10_000);
}

void loadDashboard();
