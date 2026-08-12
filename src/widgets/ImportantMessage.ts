import { el } from "@/core/dom";
import { glowFrame } from "@/components/GlowFrame";
import type { Widget } from "./types";

const VISIBLE_MS = 8000;

export function createImportantMessageWidget(): Widget {
  const textEl = el("span", { class: "tg-important-message__text" });
  const node = glowFrame({
    class: "tg-widget tg-important-message",
    children: [el("span", { class: "tg-important-message__badge", text: "MESSAGE" }), textEl],
  });
  node.style.display = "none";
  let hideTimer: number | undefined;

  return {
    id: "importantMessage",
    node,
    onEvent(event) {
      if (event.type !== "custom" || event.payload.kind !== "message") return;
      textEl.textContent = String(event.payload.text ?? "");
      node.style.display = "flex";
      node.classList.remove("tg-pop");
      void node.offsetWidth;
      node.classList.add("tg-pop");
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => (node.style.display = "none"), VISIBLE_MS);
    },
    destroy() {
      window.clearTimeout(hideTimer);
    },
  };
}
