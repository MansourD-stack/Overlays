import { el } from "@/core/dom";
import { Gauge } from "@/components/Gauge";
import { glowFrame } from "@/components/GlowFrame";
import type { Widget } from "./types";
import type { StreamerConfig } from "@/types";

export function createBossFightWidget(): Widget {
  const gauge = new Gauge({ label: "BOSS", showValue: (c, m) => `${c}/${m} PV` });
  const phaseEl = el("span", { class: "tg-boss__phase", text: "PHASE 1" });
  const node = glowFrame({
    class: "tg-widget tg-boss",
    variant: "hud",
    children: [el("div", { class: "tg-boss__head", children: [el("span", { class: "tg-boss__name", text: "BOSS" }), phaseEl] }), gauge.node],
  });
  node.style.display = "none";

  return {
    id: "bossFight",
    node,
    onConfig(config: StreamerConfig) {
      const boss = config.bossFight;
      node.style.display = boss.active ? "block" : "none";
      node.setAttribute("data-danger", String(boss.danger));
      phaseEl.textContent = `PHASE ${boss.phase}`;
      gauge.setLabel(boss.bossName);
      gauge.update(boss.hp, boss.maxHp);
    },
  };
}
