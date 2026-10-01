import { el } from "@/core/dom";
import { glowFrame } from "@/components/GlowFrame";
import { qrElement } from "@/components/QrCode";
import type { Widget } from "./types";
import type { StreamerConfig } from "@/types";

/** "Scanne pour soutenir": the Jokko support link as a QR code viewers scan
 *  from their phone. Hidden until a support URL exists (Jokko hosted mode, or
 *  `support.url` in config/streamer.json). */
export function createSupportQrWidget(): Widget {
  const codeSlot = el("div", { class: "tg-support-qr__code" });
  const urlEl = el("span", { class: "tg-support-qr__url" });
  const node = glowFrame({
    class: "tg-widget tg-support-qr",
    variant: "hud",
    children: [
      codeSlot,
      el("div", {
        class: "tg-support-qr__text",
        children: [
          el("span", { class: "tg-support-qr__title", text: "SCANNE POUR SOUTENIR" }),
          el("span", { class: "tg-support-qr__methods", text: "Wave · Orange Money · Free Money" }),
          urlEl,
        ],
      }),
    ],
  });
  let rendered = "";

  return {
    id: "supportQr",
    node,
    onConfig(config: StreamerConfig) {
      const url = config.support?.url ?? "";
      node.style.display = url ? "" : "none";
      if (!url || url === rendered) return;
      rendered = url;
      codeSlot.replaceChildren(qrElement(url, "", { label: "QR code du lien de soutien" }));
      urlEl.textContent = url.replace(/^https?:\/\//, "");
    },
  };
}
