import "@demo-install";
import "@/styles/global.css";
import "@/styles/control.css";
import { applyTheme } from "@/themes";
import { applyPerformance } from "@/core/performance";
import { configStore } from "@/core/configLoader";
import { eventBus } from "@/core/eventBus";
import { mountControlApp } from "@/control/ControlApp";
import { isThemeName } from "@/themes";

document.documentElement.setAttribute("data-control", "true");

/**
 * Logged in to Jokko? Then this panel drives the streamer's hosted channel:
 * start from the settings the server saved (not this browser's local ones),
 * so the panel shows what the OBS overlay actually displays.
 */
async function hostedChannel(): Promise<string | null> {
  try {
    const dash = await fetch("/api/dashboard", { credentials: "same-origin" });
    if (!dash.ok) return null;
    const d = await dash.json();
    const state = await fetch(`/api/overlay/state?key=${encodeURIComponent(d.overlay.key)}`).then((r) => r.json());
    configStore.patch(state.patch, false);
    if (isThemeName(state.theme)) configStore.patch({ theme: state.theme }, false);
    return d.streamer.displayName as string;
  } catch {
    return null; // no Jokko server (static build) or not logged in: local mode
  }
}

async function boot() {
  const hosted = await hostedChannel();
  const config = configStore.get();
  applyTheme(config.theme);
  applyPerformance({ profile: config.performanceProfile, reducedMotion: config.reducedMotion });
  eventBus.connect();
  mountControlApp(document.getElementById("control-app")!, hosted);
}

void boot();
