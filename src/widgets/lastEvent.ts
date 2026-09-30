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
    // Starts empty (hidden): a column of "En attente…" chips is noise, and on
    // Jokko-hosted overlays follow/sub/raid may never be fed at all.
    class: `tg-widget tg-last-event tg-last-event--${opts.id} tg-last-event--empty`,
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
      const value = opts.extract(event.payload);
      if (!value) return;
      nameEl.textContent = value;
      node.classList.remove("tg-last-event--empty");
      node.classList.remove("tg-pop");
      void node.offsetWidth;
      node.classList.add("tg-pop");
    },
  };
}
