import { Gauge } from "@/components/Gauge";
import { glowFrame } from "@/components/GlowFrame";
import type { Widget } from "./types";
import type { StreamerConfig } from "@/types";

/** Rises with follows, gifts, likes and victories. At 100% the control panel
 *  (or a real event pipeline) fires an "energy_full" event which the alerts
 *  system turns into the full "MODE FLAA'S ACTIVÉ" takeover. */
export function createEnergyTerangaWidget(): Widget {
  const gauge = new Gauge({
    label: "ÉNERGIE FLAA'S",
    showValue: (c, m) => `${Math.round((c / m) * 100)}%`,
  });
  const node = glowFrame({ class: "tg-widget tg-energy-teranga", variant: "hud", children: [gauge.node] });

  return {
    id: "energyTeranga",
    node,
    onConfig(config: StreamerConfig) {
      gauge.update(config.energyTeranga.current, config.energyTeranga.max);
    },
  };
}
