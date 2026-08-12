import "@/styles/global.css";
import "@/styles/shell.css";
import "@/styles/widgets.css";
import "@/styles/alerts.css";
import { applyTheme } from "@/themes";
import { applyPerformance } from "@/core/performance";
import { configStore } from "@/core/configLoader";
import { parseRoute } from "@/core/router";
import { eventBus } from "@/core/eventBus";
import { mountScene, findScene } from "@/scenes/mount";
import type { Layout } from "@/types";

const route = parseRoute("twitch-starting-soon", "horizontal");
let currentScene = route.scene;
let currentLayout: Layout = route.layout;

const appRoot = document.getElementById("app")!;
let dispose: (() => void) | null = null;

function remount() {
  dispose?.();
  dispose = mountScene(appRoot, currentScene, currentLayout);
}

function bootstrapTheme() {
  applyTheme(route.theme ?? configStore.get().theme);
}

bootstrapTheme();
applyPerformance({ profile: configStore.get().performanceProfile, reducedMotion: configStore.get().reducedMotion });
remount();

eventBus.connect();

eventBus.on((message) => {
  switch (message.kind) {
    case "scene-change": {
      currentScene = message.scene;
      currentLayout = findScene(currentScene)?.layout ?? currentLayout;
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
    // through config-patch. A remount is the simplest way to guarantee scene
    // structure (which widgets exist, where) always matches the latest config.
    case "config-patch":
      configStore.patch(message.patch, false);
      remount();
      break;
    default:
      break;
  }
});
