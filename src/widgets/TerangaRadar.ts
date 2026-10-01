import { el, formatCompactNumber } from "@/core/dom";
import { glowFrame } from "@/components/GlowFrame";
import type { Widget } from "./types";
import type { StreamerConfig } from "@/types";

/** Mini dashboard: viewers, energy level, and the most recent notable event
 *  at a glance — the "cockpit read-out" for the streamer's peripheral vision. */
export function createTerangaRadarWidget(): Widget {
  const viewersEl = el("span", { class: "tg-radar__value", text: "0" });
  const energyEl = el("span", { class: "tg-radar__value", text: "0%" });
  const eventEl = el("span", { class: "tg-radar__event", text: "—" });

  const node = glowFrame({
    class: "tg-widget tg-radar",
    variant: "hud",
    children: [
      el("div", { class: "tg-radar__title", text: "RADAR TERANGA" }),
      el("div", { class: "tg-radar__row", children: [el("span", { class: "tg-radar__key", text: "Viewers" }), viewersEl] }),
      el("div", { class: "tg-radar__row", children: [el("span", { class: "tg-radar__key", text: "Énergie" }), energyEl] }),
      el("div", { class: "tg-radar__row tg-radar__row--event", children: [el("span", { class: "tg-radar__key", text: "Événement" }), eventEl] }),
    ],
  });

  return {
    id: "terangaRadar",
    node,
    onConfig(config: StreamerConfig) {
      const pct = Math.round((config.energyTeranga.current / config.energyTeranga.max) * 100);
      energyEl.textContent = `${pct}%`;
    },
    onEvent(event) {
      if (event.type === "custom" && event.payload.kind === "viewers") {
        viewersEl.textContent = formatCompactNumber(Number(event.payload.count ?? 0));
        return;
      }
      const labels: Record<string, string> = {
        follow: "Nouveau follow",
        sub: "Nouvel abonné",
        gift: "Cadeau reçu",
        raid: "Raid",
        host: "Host",
        victory: "Victoire",
        defeat: "Défaite",
        energy_full: "Énergie Teranga pleine",
        donation: "Nouveau soutien",
        like_goal: "Objectif likes atteint",
      };
      if (labels[event.type]) eventEl.textContent = labels[event.type];
    },
  };
}
