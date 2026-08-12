import { el } from "@/core/dom";
import { glowFrame } from "@/components/GlowFrame";
import type { Widget } from "./types";
import type { StreamerConfig } from "@/types";

export function createRankingWidget(): Widget {
  const valueEl = el("span", { class: "tg-ranking__value", text: "#1" });
  const node = glowFrame({
    class: "tg-widget tg-ranking",
    variant: "chip",
    children: [el("span", { class: "tg-ranking__label", text: "CLASSEMENT" }), valueEl],
  });

  return {
    id: "ranking",
    node,
    onConfig(config: StreamerConfig) {
      valueEl.textContent = `#${config.ranking.position} / ${config.ranking.of}`;
    },
  };
}
