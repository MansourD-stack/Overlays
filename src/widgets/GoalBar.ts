import { Gauge } from "@/components/Gauge";
import { formatCompactNumber } from "@/core/dom";
import { glowFrame } from "@/components/GlowFrame";
import type { Widget } from "./types";
import type { StreamerConfig } from "@/types";

type GoalKey = "followers" | "likes" | "gifts" | "donations";

/** Backs goalFollowers / goalLikes / goalGifts / goalDonations — one Gauge,
 *  independent widget instances, each bound to its own config.goals.<key>. */
export function createGoalBarWidget(id: string, key: GoalKey): Widget {
  const gauge = new Gauge({
    label: key.toUpperCase(),
    // Money reads better compact on a phone: "12,5K / 50K F".
    showValue: key === "donations" ? (c, m) => `${formatCompactNumber(c)} / ${formatCompactNumber(m)} F` : undefined,
  });
  const node = glowFrame({ class: `tg-widget tg-goal-bar tg-goal-bar--${key}`, variant: "hud", children: [gauge.node] });

  return {
    id,
    node,
    onConfig(config: StreamerConfig) {
      const goal = config.goals[key];
      if (!goal) return;
      gauge.setLabel(goal.label);
      gauge.update(goal.current, goal.target);
    },
  };
}
