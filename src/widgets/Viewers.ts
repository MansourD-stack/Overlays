import { el, formatCompactNumber } from "@/core/dom";
import { glowFrame } from "@/components/GlowFrame";
import type { Widget } from "./types";

export function createViewersWidget(): Widget {
  const valueEl = el("span", { class: "tg-viewers__value", text: "0" });
  const node = glowFrame({
    class: "tg-widget tg-viewers",
    variant: "chip",
    children: [el("span", { class: "tg-viewers__label", text: "VIEWERS" }), valueEl],
  });

  return {
    id: "viewers",
    node,
    onEvent(event) {
      if (event.type === "custom" && event.payload.kind === "viewers") {
        valueEl.textContent = formatCompactNumber(Number(event.payload.count ?? 0));
      }
    },
  };
}
