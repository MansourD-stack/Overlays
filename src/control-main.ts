import "@/styles/global.css";
import "@/styles/control.css";
import { applyTheme } from "@/themes";
import { applyPerformance } from "@/core/performance";
import { configStore } from "@/core/configLoader";
import { eventBus } from "@/core/eventBus";
import { mountControlApp } from "@/control/ControlApp";

document.documentElement.setAttribute("data-control", "true");

const config = configStore.get();
applyTheme(config.theme);
applyPerformance({ profile: config.performanceProfile, reducedMotion: config.reducedMotion });

eventBus.connect();

mountControlApp(document.getElementById("control-app")!);
