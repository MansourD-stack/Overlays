import "@demo-install";
import "../jokko.css";
import { api, ApiError } from "../api";
import { fcfa } from "../format";
import { banner, button, el } from "../ui";
import { paths } from "../paths";

/* Test-mode checkout (/pay/sim/<ref>). Stands in for the aggregator's page
 * while no PayDunya keys are configured: approving sends a signed
 * notification through the real webhook pipeline. Clearly labelled as a test. */

const root = document.getElementById("jokko-app")!;
const ref = paths.currentSimRef();

async function decide(outcome: "completed" | "failed" | "cancelled") {
  const r = await api<{ returnUrl: string }>("POST", `/api/sim/payments/${encodeURIComponent(ref)}/confirm`, { outcome });
  location.href = r.returnUrl;
}

async function boot() {
  try {
    const p = await api<any>("GET", `/api/sim/payments/${encodeURIComponent(ref)}`);
    const errors = el("div");
    const guard = (outcome: "completed" | "failed" | "cancelled") => async () => {
      try {
        await decide(outcome);
      } catch (err) {
        errors.replaceChildren(banner("error", err instanceof ApiError ? err.message : "Erreur inattendue."));
      }
    };
    root.replaceChildren(
      el("main", {
        class: "jk-sim",
        children: [
          el("section", {
            class: "jk-card jk-stack",
            children: [
              el("span", { class: "jk-badge jk-badge--test", text: "Simulateur — mode test" }),
              el("h1", { text: "Valider le paiement" }),
              el("p", { class: "jk-muted", text: `Ceci remplace l'écran de ${p.methodLabel} pendant les tests. Aucun argent réel n'est débité.` }),
              el("dl", {
                class: "jk-sim__summary",
                children: [el("dt", { text: "Bénéficiaire" }), el("dd", { text: p.streamer }), el("dt", { text: "Montant" }), el("dd", { text: fcfa(p.amount) }), el("dt", { text: "Moyen" }), el("dd", { text: p.methodLabel })],
              }),
              p.status !== "pending" ? banner("ok", `Ce paiement est déjà traité (${p.status}).`) : null,
              button("Valider le paiement", "jk-btn--primary jk-btn--block", guard("completed")),
              el("div", { class: "jk-row", children: [button("Simuler un échec", "jk-btn--sm", guard("failed")), button("Annuler", "jk-btn--sm jk-btn--ghost", guard("cancelled"))] }),
              errors,
            ],
          }),
        ],
      })
    );
  } catch (err) {
    root.replaceChildren(el("main", { class: "jk-sim", children: [banner("error", err instanceof ApiError ? err.message : "Paiement introuvable.")] }));
  }
}

void boot();
