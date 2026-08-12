import { el } from "@/core/dom";
import { alertQueue } from "@/core/queue";
import { eventBus } from "@/core/eventBus";
import type { TerangaEvent, TerangaEventType } from "@/types";
import {
  followAlert,
  subAlert,
  giftAlert,
  raidAlert,
  likeWaveAlert,
  likeGoalAlert,
  victoryAlert,
  defeatAlert,
  energyFullAlert,
  type AlertView,
} from "./alertViews";

const QUEUEABLE: TerangaEventType[] = ["follow", "sub", "gift", "raid", "host", "victory", "defeat", "energy_full", "like_goal"];

function buildView(event: TerangaEvent): AlertView | null {
  switch (event.type) {
    case "follow":
      return followAlert(event);
    case "sub":
      return subAlert(event);
    case "gift":
      return giftAlert(event);
    case "raid":
    case "host":
      return raidAlert(event);
    case "victory":
      return victoryAlert();
    case "defeat":
      return defeatAlert();
    case "energy_full":
      return energyFullAlert();
    case "like_goal":
      return likeGoalAlert();
    default:
      return null;
  }
}

/** Mounts the alert layer onto a scene stage and wires it to the shared
 *  event bus + alert queue so at most one alert plays at a time. */
export function mountAlertManager(stage: HTMLElement) {
  const layer = el("div", { class: "tg-alert-layer" });
  stage.appendChild(layer);

  alertQueue.attach({
    play(event) {
      const view = buildView(event);
      if (!view) return Promise.resolve();
      layer.appendChild(view.node);
      requestAnimationFrame(() => view.node.classList.add("tg-alert--in"));
      if (event.type === "energy_full") stage.classList.add("tg-stage--boost-mode");
      return new Promise<void>((resolve) => {
        window.setTimeout(() => {
          view.node.classList.add("tg-alert--out");
          window.setTimeout(() => {
            view.node.remove();
            if (event.type === "energy_full") stage.classList.remove("tg-stage--boost-mode");
            resolve();
          }, 420);
        }, view.durationMs);
      });
    },
  });

  eventBus.on((message) => {
    if (message.kind !== "event") return;
    if (QUEUEABLE.includes(message.event.type)) alertQueue.push(message.event);
  });

  // Likes come in bursts and are intentionally NOT queued one-by-one — a
  // rolling wave animation instead, throttled so it never overlaps itself.
  let waveActive = false;
  eventBus.on((message) => {
    if (message.kind !== "event" || message.event.type !== "custom" || message.event.payload.kind !== "like_wave") return;
    if (waveActive) return;
    waveActive = true;
    const view = likeWaveAlert();
    layer.appendChild(view.node);
    requestAnimationFrame(() => view.node.classList.add("tg-alert--in"));
    window.setTimeout(() => {
      view.node.classList.add("tg-alert--out");
      window.setTimeout(() => {
        view.node.remove();
        waveActive = false;
      }, 420);
    }, view.durationMs);
  });
}
