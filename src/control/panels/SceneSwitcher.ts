import { el } from "@/core/dom";
import { eventBus } from "@/core/eventBus";
import { HORIZONTAL_SCENES } from "@/scenes/horizontal/registry";
import { VERTICAL_SCENES } from "@/scenes/vertical/registry";
import { buildSceneUrl } from "@/core/router";
import { configStore } from "@/core/configLoader";

function sceneRow(scene: { id: string; title: string; description: string; layout: "horizontal" | "vertical" }) {
  const previewUrl = buildSceneUrl(scene.id, scene.layout);
  const goButton = el("button", { class: "tg-ctrl-btn", text: "Afficher" });
  goButton.addEventListener("click", () => eventBus.send({ kind: "scene-change", scene: scene.id }));

  const link = el("a", { class: "tg-ctrl-link", text: "Aperçu ↗", attrs: { href: previewUrl, target: "_blank", rel: "noopener" } });

  return el("div", {
    class: "tg-ctrl-row",
    children: [
      el("div", {
        class: "tg-ctrl-row__text",
        children: [el("span", { class: "tg-ctrl-row__title", text: scene.title }), el("span", { class: "tg-ctrl-row__desc", text: scene.description })],
      }),
      goButton,
      link,
    ],
  });
}

export function sceneSwitcherPanel(): HTMLElement {
  return el("section", {
    class: "tg-ctrl-panel",
    children: [
      el("h2", { class: "tg-ctrl-panel__title", text: "Scènes" }),
      el("p", { class: "tg-ctrl-panel__hint", text: `URL Browser Source actuelle (défaut) : ${configStore.get().theme}. "Afficher" bascule toutes les scènes ouvertes en direct.` }),
      el("h3", { class: "tg-ctrl-subtitle", text: "Horizontal — 1920×1080" }),
      el("div", { class: "tg-ctrl-list", children: HORIZONTAL_SCENES.map(sceneRow) }),
      el("h3", { class: "tg-ctrl-subtitle", text: "Vertical — 1080×1920 (TikTok LIVE)" }),
      el("div", { class: "tg-ctrl-list", children: VERTICAL_SCENES.map(sceneRow) }),
    ],
  });
}
