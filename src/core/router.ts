import { isThemeName, type ThemeName } from "@/themes";
import type { Layout } from "@/types";

export interface RouteParams {
  scene: string;
  layout: Layout;
  theme: ThemeName | null;
  /** Jokko overlay key: when present the scene joins that streamer's hosted channel. */
  key: string | null;
}

/** Short, layout-aware names from the spec (/?scene=brb, /?scene=starting-soon…).
 *  The same alias resolves to the horizontal or vertical scene depending on ?layout. */
const ALIASES: Record<string, { horizontal: string; vertical: string }> = {
  gameplay: { horizontal: "twitch-gameplay-webcam", vertical: "tiktok-gameplay" },
  "twitch-gameplay": { horizontal: "twitch-gameplay-webcam", vertical: "twitch-gameplay-webcam" },
  "gameplay-webcam": { horizontal: "twitch-gameplay-webcam", vertical: "tiktok-gameplay-webcam" },
  "starting-soon": { horizontal: "twitch-starting-soon", vertical: "tiktok-starting-soon" },
  brb: { horizontal: "twitch-brb", vertical: "tiktok-pause" },
  pause: { horizontal: "twitch-brb", vertical: "tiktok-pause" },
  "just-chatting": { horizontal: "twitch-justchatting", vertical: "tiktok-justchatting" },
  ending: { horizontal: "twitch-ending", vertical: "tiktok-ending" },
  "fin-de-stream": { horizontal: "twitch-ending", vertical: "tiktok-ending" },
};

const DEFAULT_SCENE: Record<Layout, string> = { horizontal: "twitch-starting-soon", vertical: "tiktok-gameplay" };

export function resolveSceneId(scene: string | null, layout: Layout): string {
  if (!scene) return DEFAULT_SCENE[layout];
  return ALIASES[scene]?.[layout] ?? scene;
}

/** Every overlay page is addressed purely through the query string, e.g.
 *  /?scene=tiktok-gameplay-webcam&layout=vertical — this is what makes scenes
 *  addable as OBS/TikTok LIVE Studio Browser Sources without a build step per scene. */
export function parseRoute(): RouteParams {
  const params = new URLSearchParams(window.location.search);
  const layoutParam = params.get("layout");
  const sceneParam = params.get("scene");
  const inferred: Layout = sceneParam?.startsWith("tiktok-") ? "vertical" : "horizontal";
  const layout: Layout = layoutParam === "horizontal" || layoutParam === "vertical" ? layoutParam : inferred;
  const themeParam = params.get("theme");
  const theme = isThemeName(themeParam) ? themeParam : null;
  return { scene: resolveSceneId(sceneParam, layout), layout, theme, key: params.get("key") };
}

export function buildSceneUrl(scene: string, layout: Layout, theme?: ThemeName): string {
  const params = new URLSearchParams({ scene, layout });
  if (theme) params.set("theme", theme);
  const key = new URLSearchParams(window.location.search).get("key");
  if (key) params.set("key", key);
  return `/?${params.toString()}`;
}
