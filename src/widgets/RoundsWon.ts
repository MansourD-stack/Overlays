import { el } from "@/core/dom";
import { glowFrame } from "@/components/GlowFrame";
import type { Widget } from "./types";
import type { StreamerConfig } from "@/types";

export function createRoundsWonWidget(): Widget {
  const pipsHost = el("div", { class: "tg-rounds__pips" });
  const node = glowFrame({
    class: "tg-widget tg-rounds",
    variant: "hud",
    children: [el("span", { class: "tg-rounds__label", text: "MANCHES" }), pipsHost],
  });

  return {
    id: "roundsWon",
    node,
    onConfig(config: StreamerConfig) {
      pipsHost.innerHTML = "";
      const { roundsWon, roundsTotal } = config.score;
      for (let i = 0; i < roundsTotal; i++) {
        pipsHost.appendChild(el("span", { class: `tg-rounds__pip ${i < roundsWon ? "tg-rounds__pip--won" : ""}` }));
      }
    },
  };
}
