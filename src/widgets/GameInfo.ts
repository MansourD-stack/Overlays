import { el } from "@/core/dom";
import { glowFrame } from "@/components/GlowFrame";
import type { Widget } from "./types";
import type { StreamerConfig } from "@/types";

export function createGameInfoWidget(): Widget {
  const gameEl = el("span", { class: "tg-game-info__game", text: "" });
  const node = glowFrame({
    class: "tg-widget tg-game-info",
    variant: "chip",
    children: [el("span", { class: "tg-game-info__dot" }), gameEl],
  });

  return {
    id: "gameInfo",
    node,
    onConfig(config: StreamerConfig) {
      gameEl.textContent = config.game;
    },
  };
}
