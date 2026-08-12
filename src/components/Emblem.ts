import { el } from "@/core/dom";
import { mountInlineSvg } from "./InlineSvg";

export type EmblemVariant = "icon" | "full-light" | "full-dark" | "mono";

const ASSET: Record<EmblemVariant, string> = {
  icon: "/assets/emblem/emblem-icon.svg",
  "full-light": "/assets/emblem/emblem-full-light.svg",
  "full-dark": "/assets/emblem/emblem-full-dark.svg",
  mono: "/assets/emblem/emblem-mono.svg",
};

export function emblem(variant: EmblemVariant = "icon", cls = ""): HTMLDivElement {
  const node = el("div", { class: `tg-emblem ${cls}`.trim() });
  void mountInlineSvg(node, ASSET[variant]);
  return node;
}
