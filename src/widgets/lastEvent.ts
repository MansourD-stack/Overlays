import { el } from "@/core/dom";
import { glowFrame } from "@/components/GlowFrame";
import type { Widget } from "./types";
import type { TerangaEventType } from "@/types";

interface LastEventOptions {
  id: string;
  label: string;
  matches: TerangaEventType[];
  fallback: string;
  extract: (payload: Record<string, unknown>) => string;
}

/** Shared factory behind lastFollower / lastSub / lastDonation / lastGift /
 *  raidHost — each still mounts as its own independent widget instance, only
 *  the "watch an event type, show the latest name" behaviour is shared. */
export function createLastEventWidget(opts: LastEventOptions): Widget {
  const nameEl = el("span", { class: "tg-last-event__name", text: opts.fallback });
  const node = glowFrame({
    class: `tg-widget tg-last-event tg-last-event--${opts.id}`,
    variant: "chip",
    children: [
      el("span", { class: "tg-last-event__dot" }),
      el("span", { class: "tg-last-event__label", text: opts.label }),
      nameEl,
    ],
  });

  return {
    id: opts.id,
    node,
    onEvent(event) {
      if (!opts.matches.includes(event.type)) return;
      nameEl.textContent = opts.extract(event.payload) || opts.fallback;
      node.classList.remove("tg-pop");
      void node.offsetWidth;
      node.classList.add("tg-pop");
    },
  };
}
