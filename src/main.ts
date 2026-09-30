import "@/styles/global.css";
import "@/styles/shell.css";
import "@/styles/widgets.css";
import "@/styles/alerts.css";
import { applyTheme, isThemeName } from "@/themes";
import { applyPerformance } from "@/core/performance";
import { configStore } from "@/core/configLoader";
import { parseRoute, resolveSceneId } from "@/core/router";
import { eventBus } from "@/core/eventBus";
import { mountScene, findScene } from "@/scenes/mount";
import type { DeepPartial, Layout, StreamerConfig } from "@/types";

const route = parseRoute();
let currentScene = route.scene;
let currentLayout: Layout = route.layout;

const appRoot = document.getElementById("app")!;
let dispose: (() => void) | null = null;

function remount() {
  dispose?.();
  dispose = mountScene(appRoot, currentScene, currentLayout);
}

applyTheme(route.theme ?? configStore.get().theme);
applyPerformance({ profile: configStore.get().performanceProfile, reducedMotion: configStore.get().reducedMotion });
remount();

/**
 * Jokko hosted mode (?key=…): the streamer's identity, theme and donation goal
 * come from the Jokko server instead of this browser's local config, and are
 * re-synced on every reconnection so an overlay that was offline catches up.
 */
async function syncHostedState() {
  if (!route.key) return;
  try {
    const res = await fetch(`/api/overlay/state?key=${encodeURIComponent(route.key)}`);
    if (!res.ok) return;
    const state = (await res.json()) as { theme: string; patch: DeepPartial<StreamerConfig> };
    configStore.patch(state.patch, false);
    if (!route.theme && isThemeName(state.theme)) {
      configStore.patch({ theme: state.theme }, false);
      applyTheme(state.theme);
    }
    remount();
  } catch {
    /* server unreachable — keep rendering with what we have */
  }
}

eventBus.onOpen(() => void syncHostedState());
eventBus.connect(route.key);

eventBus.on((message) => {
  switch (message.kind) {
    case "scene-change": {
      currentLayout = findScene(message.scene)?.layout ?? currentLayout;
      currentScene = resolveSceneId(message.scene, currentLayout);
      const params = new URLSearchParams(window.location.search);
      params.set("scene", currentScene);
      params.set("layout", currentLayout);
      window.history.replaceState(null, "", `?${params.toString()}`);
      remount();
      break;
    }
    case "theme-change":
      configStore.patch({ theme: message.theme }, false);
      if (!route.theme) applyTheme(message.theme);
      break;
    case "performance-change":
      configStore.patch({ performanceProfile: message.profile, reducedMotion: message.reducedMotion }, false);
      applyPerformance({ profile: message.profile, reducedMotion: message.reducedMotion });
      break;
    case "widget-toggle": {
      const widgets = { ...configStore.get().widgets };
      const entry = widgets[message.widget];
      if (entry) widgets[message.widget] = { ...entry, enabled: message.enabled };
      configStore.patch({ widgets }, false);
      remount();
      break;
    }
    // Widget docking/scale/color, goals, score, boss fight, socials… all flow
    // through config-patch. Goal-only patches (every donation) just update the
    // live widgets; anything structural remounts so the scene always matches config.
    case "config-patch": {
      configStore.patch(message.patch, false);
      const keys = Object.keys(message.patch);
      const liveOnly = keys.every((k) => k === "goals" || k === "lastSupporter");
      if (!liveOnly) remount();
      break;
    }
    default:
      break;
  }
});
