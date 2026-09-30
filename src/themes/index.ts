import "./tokens.css";
import "./dakar-neon.css";
import "./flaas-fire.css";
import "./atlantic-cyber.css";
import "./tournament.css";
import "./night-mode.css";

export const THEMES = [
  "dakar-neon",
  "flaas-fire",
  "atlantic-cyber",
  "tournament",
  "night-mode",
] as const;

export type ThemeName = (typeof THEMES)[number];

export const THEME_LABELS: Record<ThemeName, string> = {
  "dakar-neon": "Dakar Neon",
  "flaas-fire": "Teranga Fire",
  "atlantic-cyber": "Atlantic Cyber",
  tournament: "Tournament",
  "night-mode": "Night Mode",
};

export function isThemeName(value: string | null): value is ThemeName {
  return !!value && (THEMES as readonly string[]).includes(value);
}

/** Swaps the active theme purely by changing a data-attribute — no code path branches on theme. */
export function applyTheme(theme: ThemeName) {
  document.documentElement.setAttribute("data-theme", theme);
  window.dispatchEvent(new CustomEvent("overlay:theme-changed", { detail: { theme } }));
}
