import { isThemeName, type ThemeName } from "@/themes";
import type { Layout } from "@/types";

export interface RouteParams {
  scene: string;
  layout: Layout;
  theme: ThemeName | null;
}

/** Every overlay page is addressed purely through the query string, e.g.
 *  /?scene=tiktok-gameplay-webcam&layout=vertical — this is what makes scenes
 *  addable as OBS/TikTok LIVE Studio Browser Sources without a build step per scene. */
export function parseRoute(defaultScene: string, defaultLayout: Layout): RouteParams {
  const params = new URLSearchParams(window.location.search);
  const scene = params.get("scene") ?? defaultScene;
  const layoutParam = params.get("layout");
  const layout: Layout = layoutParam === "horizontal" || layoutParam === "vertical" ? layoutParam : defaultLayout;
  const themeParam = params.get("theme");
  const theme = isThemeName(themeParam) ? themeParam : null;
  return { scene, layout, theme };
}

export function buildSceneUrl(scene: string, layout: Layout, theme?: ThemeName): string {
  const params = new URLSearchParams({ scene, layout });
  if (theme) params.set("theme", theme);
  return `/?${params.toString()}`;
}
