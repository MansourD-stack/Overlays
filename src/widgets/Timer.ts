import { el } from "@/core/dom";
import { glowFrame } from "@/components/GlowFrame";
import type { Widget } from "./types";

function format(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

/** Session stopwatch — starts counting the moment the scene mounts. Doubles
 *  as the "starting soon" / "pause" countdown display; a control-panel
 *  "custom" event with payload.kind === "timer-reset" restarts it at zero. */
export function createTimerWidget(): Widget {
  const valueEl = el("span", { class: "tg-timer__value", text: "00:00" });
  const node = glowFrame({
    class: "tg-widget tg-timer",
    variant: "chip",
    children: [el("span", { class: "tg-timer__label", text: "SESSION" }), valueEl],
  });

  let startedAt = Date.now();
  const interval = window.setInterval(() => {
    valueEl.textContent = format((Date.now() - startedAt) / 1000);
  }, 1000);

  return {
    id: "timer",
    node,
    onEvent(event) {
      if (event.type === "custom" && event.payload.kind === "timer-reset") {
        startedAt = Date.now();
      }
    },
    destroy() {
      window.clearInterval(interval);
    },
  };
}
