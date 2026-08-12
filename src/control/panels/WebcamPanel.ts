import { el } from "@/core/dom";
import { configStore } from "@/core/configLoader";
import { pushConfig } from "../bridge";
import { checkboxField, selectField } from "./fields";
import type { WebcamMode, WebcamShape } from "@/types";

export function webcamPanel(): HTMLElement {
  const c = configStore.get().webcam;

  return el("section", {
    class: "tg-ctrl-panel",
    children: [
      el("h2", { class: "tg-ctrl-panel__title", text: "Webcam" }),
      el("p", { class: "tg-ctrl-panel__hint", text: "Positionne votre source vidéo OBS/TikTok LIVE Studio sur le cadre-guide affiché." }),
      el("div", {
        class: "tg-ctrl-grid",
        children: [
          checkboxField("Visible", c.visible, (v) => pushConfig({ webcam: { visible: v } })),
          selectField("Mode (vertical)", c.mode, ["top", "float"], (v) => pushConfig({ webcam: { mode: v as WebcamMode } })),
          selectField("Forme (fenêtre flottante)", c.floatShape, ["circle", "hex"], (v) => pushConfig({ webcam: { floatShape: v as WebcamShape } })),
        ],
      }),
    ],
  });
}
