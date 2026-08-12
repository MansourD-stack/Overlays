import type { PerformanceProfile } from "@/types";

export interface PerformanceSettings {
  profile: PerformanceProfile;
  reducedMotion: boolean;
}

const PARTICLE_BUDGET: Record<PerformanceProfile, number> = {
  low: 0,
  balanced: 40,
  ultra: 110,
};

const GLOW_BLUR: Record<PerformanceProfile, string> = {
  low: "0px",
  balanced: "18px",
  ultra: "36px",
};

/** Applies a performance profile as DOM attributes so any component's CSS
 *  can read [data-perf] / [data-motion] without importing this module. */
export function applyPerformance(settings: PerformanceSettings) {
  document.documentElement.setAttribute("data-perf", settings.profile);
  document.documentElement.setAttribute("data-motion", settings.reducedMotion ? "reduced" : "full");
  document.documentElement.style.setProperty("--glow-blur", GLOW_BLUR[settings.profile]);
  window.dispatchEvent(new CustomEvent("overlay:performance-changed", { detail: settings }));
}

export function particleBudget(profile: PerformanceProfile): number {
  return PARTICLE_BUDGET[profile];
}

export function prefersReducedMotion(settings: PerformanceSettings): boolean {
  return settings.reducedMotion || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
