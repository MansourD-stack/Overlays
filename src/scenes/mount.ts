import { HORIZONTAL_SCENES } from "./horizontal/registry";
import { VERTICAL_SCENES } from "./vertical/registry";
import { mountScene as renderScene } from "./shell";
import type { Layout } from "@/types";
import type { SceneEntry } from "./types";

export const ALL_SCENES: SceneEntry[] = [...HORIZONTAL_SCENES, ...VERTICAL_SCENES];

export function findScene(id: string): SceneEntry | undefined {
  return ALL_SCENES.find((s) => s.id === id);
}

/** Keeps the fixed 1920x1080 / 1080x1920 stage scaled-to-fit whatever size
 *  the Browser Source (or a plain preview tab) actually is, so the same
 *  scene renders correctly whether it's the exact canvas size or not. */
function fitStage(stage: HTMLElement, layout: Layout) {
  const [w, h] = layout === "vertical" ? [1080, 1920] : [1920, 1080];
  const apply = () => {
    const scale = Math.min(window.innerWidth / w, window.innerHeight / h);
    stage.style.transform = `scale(${scale})`;
    stage.style.position = "absolute";
    stage.style.left = `${(window.innerWidth - w * scale) / 2}px`;
    stage.style.top = `${(window.innerHeight - h * scale) / 2}px`;
  };
  apply();
  window.addEventListener("resize", apply);
}

export function mountScene(root: HTMLElement, sceneId: string, layout: Layout): () => void {
  const scene = findScene(sceneId) ?? findScene(layout === "vertical" ? "tiktok-gameplay" : "twitch-gameplay-nowebcam")!;
  const dispose = renderScene(root, scene, scene);
  const stage = root.querySelector<HTMLElement>(".tg-stage");
  if (stage) fitStage(stage, scene.layout);
  return dispose;
}
