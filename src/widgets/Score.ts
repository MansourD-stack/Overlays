import { el } from "@/core/dom";
import { glowFrame } from "@/components/GlowFrame";
import type { Widget } from "./types";
import type { StreamerConfig } from "@/types";

export function createScoreWidget(): Widget {
  const teamEl = el("span", { class: "tg-score__value", text: "0" });
  const oppEl = el("span", { class: "tg-score__value", text: "0" });
  const node = glowFrame({
    class: "tg-widget tg-score",
    variant: "hud",
    children: [
      el("div", { class: "tg-score__side", children: [el("span", { class: "tg-score__label", text: "FLAA'S" }), teamEl] }),
      el("span", { class: "tg-score__sep", text: "—" }),
      el("div", { class: "tg-score__side", children: [el("span", { class: "tg-score__label", text: "ADVERSAIRE" }), oppEl] }),
    ],
  });

  return {
    id: "score",
    node,
    onConfig(config: StreamerConfig) {
      teamEl.textContent = String(config.score.team);
      oppEl.textContent = String(config.score.opponent);
    },
  };
}
