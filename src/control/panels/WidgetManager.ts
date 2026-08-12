import { el } from "@/core/dom";
import { configStore } from "@/core/configLoader";
import { pushConfig } from "../bridge";
import { WIDGET_IDS, WIDGET_LABELS } from "@/widgets/registry";
import { checkboxField, selectField, rangeField } from "./fields";
import type { Dock } from "@/types";

const DOCKS: Dock[] = ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"];

function widgetRow(id: string): HTMLElement {
  const c = configStore.get();
  const entry = c.widgets[id] ?? { enabled: false, scenes: [] };

  const enabled = checkboxField("Activé", entry.enabled, (v) => pushConfig({ widgets: { [id]: { enabled: v, scenes: entry.scenes } } }));
  const dock = selectField("Position", c.widgetDocks[id] ?? "top-left", DOCKS, (v) => pushConfig({ widgetDocks: { [id]: v as Dock } }));
  const scale = rangeField("Taille", c.widgetScale[id] ?? 1, 0.6, 1.6, 0.05, (v) => pushConfig({ widgetScale: { [id]: v } }));

  const colorInput = el("input", { attrs: { type: "color", value: c.widgetColors[id] || "#12e19a" } });
  colorInput.addEventListener("input", () => pushConfig({ widgetColors: { [id]: colorInput.value } }));
  const resetColorBtn = el("button", { class: "tg-ctrl-btn tg-ctrl-btn--sm", text: "Réinitialiser couleur" });
  resetColorBtn.addEventListener("click", () => {
    const widgetColors = { ...configStore.get().widgetColors };
    delete widgetColors[id];
    pushConfig({ widgetColors });
  });

  return el("div", {
    class: "tg-widget-row",
    children: [
      el("span", { class: "tg-widget-row__id", text: WIDGET_LABELS[id] ?? id }),
      enabled,
      dock,
      scale,
      el("label", { class: "tg-ctrl-field", children: [el("span", { text: "Couleur" }), colorInput] }),
      resetColorBtn,
    ],
  });
}

export function widgetManagerPanel(): HTMLElement {
  return el("section", {
    class: "tg-ctrl-panel",
    children: [
      el("h2", { class: "tg-ctrl-panel__title", text: "Widgets" }),
      el("p", { class: "tg-ctrl-panel__hint", text: "Chaque widget est activable, déplaçable (position), redimensionnable et recolorable indépendamment." }),
      el("div", { class: "tg-widget-list", children: WIDGET_IDS.map(widgetRow) }),
    ],
  });
}
