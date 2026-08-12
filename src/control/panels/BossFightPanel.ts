import { el } from "@/core/dom";
import { configStore } from "@/core/configLoader";
import { pushConfig } from "../bridge";
import { checkboxField, numberField, textField } from "./fields";

export function bossFightPanel(): HTMLElement {
  const c = configStore.get().bossFight;

  return el("section", {
    class: "tg-ctrl-panel",
    children: [
      el("h2", { class: "tg-ctrl-panel__title", text: "Mode Boss Fight" }),
      el("div", {
        class: "tg-ctrl-grid",
        children: [
          checkboxField("Actif", c.active, (v) => pushConfig({ bossFight: { active: v } })),
          checkboxField("Danger", c.danger, (v) => pushConfig({ bossFight: { danger: v } })),
          textField("Nom du boss", c.bossName, (v) => pushConfig({ bossFight: { bossName: v } })),
          numberField("PV actuels", c.hp, (v) => pushConfig({ bossFight: { hp: v } })),
          numberField("PV max", c.maxHp, (v) => pushConfig({ bossFight: { maxHp: v } })),
          numberField("Phase", c.phase, (v) => pushConfig({ bossFight: { phase: v } })),
        ],
      }),
    ],
  });
}
