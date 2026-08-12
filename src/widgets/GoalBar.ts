import { Gauge } from "@/components/Gauge";
import { glowFrame } from "@/components/GlowFrame";
import type { Widget } from "./types";
import type { StreamerConfig } from "@/types";

type GoalKey = "followers" | "likes" | "gifts";

/** Backs goalFollowers / goalLikes / goalGifts — one Gauge, three independent
 *  widget instances, each bound to its own config.goals.<key>. */
export function createGoalBarWidget(id: string, key: GoalKey): Widget {
  const gauge = new Gauge({ label: key.toUpperCase() });
  const node = glowFrame({ class: `tg-widget tg-goal-bar tg-goal-bar--${key}`, variant: "hud", children: [gauge.node] });

  return {
    id,
    node,
    onConfig(config: StreamerConfig) {
      const goal = config.goals[key];
      gauge.setLabel(goal.label);
      gauge.update(goal.current, goal.target);
    },
  };
}
