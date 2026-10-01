import type { ThemeName } from "@/themes";

export type Layout = "horizontal" | "vertical";
export type PerformanceProfile = "low" | "balanced" | "ultra";
export type WebcamMode = "top" | "float";
export type WebcamShape = "circle" | "hex";
export type Dock = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";

export type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;

export interface Goal {
  current: number;
  target: number;
  label: string;
}

export interface StreamerConfig {
  pseudo: string;
  /** Community name used in alerts ("Bienvenue dans la …"). Per streamer in Jokko hosted mode. */
  communityName: string;
  tagline: string;
  game: string;
  socials: { twitch: string; tiktok: string; youtube: string; kick: string };
  theme: ThemeName;
  performanceProfile: PerformanceProfile;
  reducedMotion: boolean;
  /** donations = cumulative Jokko mobile-money donations, in F CFA. */
  goals: { followers: Goal; likes: Goal; gifts: Goal; donations: Goal };
  webcam: { mode: WebcamMode; floatShape: WebcamShape; visible: boolean };
  energyTeranga: { current: number; max: number };
  bossFight: {
    active: boolean;
    bossName: string;
    hp: number;
    maxHp: number;
    phase: number;
    danger: boolean;
  };
  score: { team: number; opponent: number; roundsWon: number; roundsTotal: number };
  ranking: { position: number; of: number };
  lastSupporter: { name: string; type: string };
  /** Jokko support page. Filled automatically in hosted mode; feeds the supportQr widget. */
  support: { url: string };
  easterEggs: { enabled: boolean; dakarMode: boolean; chatCommand: string; keyCombo: string };
  widgets: Record<string, { enabled: boolean; scenes: string[] }>;
  /** Per-widget placement/appearance — this is what makes widgets "déplaçable,
   *  redimensionnable, recolorable" from the control panel without a code change. */
  widgetDocks: Record<string, Dock>;
  widgetScale: Record<string, number>;
  widgetColors: Record<string, string>;
}

export type TerangaEventType =
  | "follow"
  | "sub"
  | "gift"
  | "donation"
  | "like_goal"
  | "raid"
  | "host"
  | "victory"
  | "defeat"
  | "energy_full"
  | "boss_fight"
  | "custom";

export interface TerangaEvent {
  id: string;
  type: TerangaEventType;
  payload: Record<string, unknown>;
  ts: number;
}

/** Messages exchanged over the local bridge between /control and overlay scenes. */
export type BridgeMessage =
  | { kind: "event"; event: TerangaEvent }
  | { kind: "config-patch"; patch: DeepPartial<StreamerConfig> }
  | { kind: "scene-change"; scene: string }
  | { kind: "theme-change"; theme: ThemeName }
  | { kind: "performance-change"; profile: PerformanceProfile; reducedMotion: boolean }
  | { kind: "widget-toggle"; widget: string; enabled: boolean };

export interface SceneDefinition {
  id: string;
  layout: Layout;
  title: string;
  description: string;
  webcamSlot: "none" | "top" | "corner" | "float" | "full";
  ctaZone: boolean;
  clean: boolean;
  widgets: string[];
  accent?: "neutral" | "victory" | "defeat" | "tournament";
}
