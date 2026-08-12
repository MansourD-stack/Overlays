import { el } from "@/core/dom";

interface GlowFrameOptions {
  class?: string;
  variant?: "panel" | "chip" | "hud";
  children?: (Node | null | undefined | false)[];
}

/** The single reusable "cut-corner glass panel" building block every widget
 *  and scene frame is made of — this is what keeps 23 scenes visually one family. */
export function glowFrame(opts: GlowFrameOptions = {}): HTMLDivElement {
  return el("div", {
    class: `tg-panel tg-panel--${opts.variant ?? "panel"} ${opts.class ?? ""}`.trim(),
    children: opts.children,
  });
}
