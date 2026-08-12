import { el } from "@/core/dom";
import { configStore } from "@/core/configLoader";
import { eventBus } from "@/core/eventBus";
import { pushConfig } from "../bridge";
import { selectField, checkboxField } from "./fields";
import type { PerformanceProfile } from "@/types";

const PROFILES: PerformanceProfile[] = ["low", "balanced", "ultra"];

export function performancePanel(): HTMLElement {
  const c = configStore.get();

  function broadcast(profile: PerformanceProfile, reducedMotion: boolean) {
    pushConfig({ performanceProfile: profile, reducedMotion });
    eventBus.send({ kind: "performance-change", profile, reducedMotion });
  }

  let profile = c.performanceProfile;
  let reducedMotion = c.reducedMotion;

  const profileField = selectField("Profil de performance", profile, PROFILES, (v) => {
    profile = v as PerformanceProfile;
    broadcast(profile, reducedMotion);
  });
  const motionField = checkboxField("Réduire les animations (reducedMotion)", reducedMotion, (v) => {
    reducedMotion = v;
    broadcast(profile, reducedMotion);
  });

  return el("section", {
    class: "tg-ctrl-panel",
    children: [
      el("h2", { class: "tg-ctrl-panel__title", text: "Performance" }),
      el("p", { class: "tg-ctrl-panel__hint", text: "low = aucune particule / effets minimaux · balanced = équilibré · ultra = tous les effets." }),
      profileField,
      motionField,
    ],
  });
}
