import { el } from "@/core/dom";
import { emblem } from "@/components/Emblem";
import { eventBus } from "@/core/eventBus";
import { sceneSwitcherPanel } from "./panels/SceneSwitcher";
import { themeSwitcherPanel } from "./panels/ThemeSwitcher";
import { textGoalEditorPanel } from "./panels/TextGoalEditor";
import { alertSimulatorPanel } from "./panels/AlertSimulator";
import { widgetManagerPanel } from "./panels/WidgetManager";
import { performancePanel } from "./panels/PerformancePanel";
import { bossFightPanel } from "./panels/BossFightPanel";
import { webcamPanel } from "./panels/WebcamPanel";

/** The control panel is a distinct page (control.html → /control) — it must
 *  never be reachable from an OBS/TikTok LIVE Studio Browser Source URL. */
export function mountControlApp(root: HTMLElement) {
  const statusDot = el("span", { class: "tg-status-dot" });
  const statusLabel = el("span", { class: "tg-status-label", text: "Connexion…" });

  const header = el("header", {
    class: "tg-ctrl-header",
    children: [
      emblem("full-dark", "tg-ctrl-header__logo"),
      el("div", { class: "tg-ctrl-header__title", children: [el("h1", { text: "Panneau de contrôle" }), el("p", { text: "Ne s'affiche jamais dans les scènes de stream." })] }),
      el("div", { class: "tg-ctrl-status", children: [statusDot, statusLabel] }),
    ],
  });

  root.appendChild(header);
  root.appendChild(
    el("main", {
      class: "tg-ctrl-main",
      children: [
        sceneSwitcherPanel(),
        themeSwitcherPanel(),
        webcamPanel(),
        textGoalEditorPanel(),
        bossFightPanel(),
        widgetManagerPanel(),
        alertSimulatorPanel(),
        performancePanel(),
      ],
    })
  );

  const updateStatus = () => {
    statusDot.classList.toggle("tg-status-dot--on", eventBus.isConnected);
    statusLabel.textContent = eventBus.isConnected ? "Connecté au bus local" : "Hors ligne — relance npm run dev";
  };
  updateStatus();
  window.setInterval(updateStatus, 1500);
}
