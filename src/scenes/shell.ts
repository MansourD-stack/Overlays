import { el } from "@/core/dom";
import { glowFrame } from "@/components/GlowFrame";
import { emblem } from "@/components/Emblem";
import { Mascot, type MascotState } from "@/components/Mascot";
import { ParticleField } from "@/components/ParticleField";
import { mountAlertManager } from "@/alerts/AlertManager";
import { configStore } from "@/core/configLoader";
import { WIDGET_REGISTRY } from "@/widgets/registry";
import type { Widget } from "@/widgets/types";
import type { Dock, SceneDefinition, StreamerConfig } from "@/types";
import { applyPerformance } from "@/core/performance";
import { eventBus } from "@/core/eventBus";

const DOCKS: Dock[] = ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"];

const MASCOT_REACTION: Record<string, { state: MascotState; holdMs: number }> = {
  follow: { state: "happy", holdMs: 2500 },
  sub: { state: "happy", holdMs: 3000 },
  raid: { state: "happy", holdMs: 3000 },
  host: { state: "happy", holdMs: 3000 },
};

export interface SceneExtras {
  heroTitle?: string;
  heroSubtitle?: string;
  showSocials?: boolean;
  mascotState?: MascotState;
}

function widgetIsActiveInScene(id: string, sceneId: string, config: StreamerConfig): boolean {
  const entry = config.widgets[id];
  if (!entry || !entry.enabled) return false;
  return entry.scenes.includes("*") || entry.scenes.includes(sceneId);
}

function socialsPanel(config: StreamerConfig): HTMLDivElement {
  const items = Object.entries(config.socials).filter(([, v]) => v);
  return glowFrame({
    class: "tg-socials",
    variant: "hud",
    children: items.map(([k, v]) => el("div", { class: "tg-socials__row", children: [el("span", { class: "tg-socials__key", text: k.toUpperCase() }), el("span", { class: "tg-socials__value", text: v })] })),
  });
}

export function mountScene(root: HTMLElement, def: SceneDefinition, extras: SceneExtras = {}): () => void {
  root.innerHTML = "";
  const config = configStore.get();

  const stage = el("div", { class: "tg-stage", attrs: { "data-layout": def.layout, "data-scene": def.id, "data-accent": def.accent ?? "neutral" } });
  root.appendChild(stage);
  stage.appendChild(el("div", { class: "tg-stage__bg-grid" }));

  const particles = new ParticleField();
  stage.appendChild(particles.node);
  particles.setProfile(config.performanceProfile, config.reducedMotion);
  particles.start();

  const activeWidgets: Widget[] = [];
  const unsubscribers: (() => void)[] = [];

  if (!def.clean) {
    // Identity bar — always the same shape, top-left: emblem, pseudo, game, live status.
    stage.appendChild(
      el("div", {
        class: "tg-identity",
        children: [
          emblem("icon", "tg-identity__emblem"),
          el("div", {
            class: "tg-identity__text",
            children: [
              el("span", { class: "tg-identity__pseudo", text: config.pseudo }),
              el("span", { class: "tg-identity__meta", text: `${config.game} · EN DIRECT` }),
            ],
          }),
        ],
      })
    );

    // Webcam guide frame — "float" scenes respect the streamer's chosen mode (top vs floating window).
    const effectiveWebcamSlot = def.webcamSlot === "float" && config.webcam.mode === "top" ? "top" : def.webcamSlot;
    if (effectiveWebcamSlot !== "none" && config.webcam.visible) {
      stage.appendChild(
        el("div", {
          class: `tg-webcam-slot tg-webcam-slot--${effectiveWebcamSlot} tg-webcam-slot--shape-${config.webcam.floatShape}`,
          children: [el("span", { class: "tg-webcam-slot__label", text: "WEBCAM (OBS / TikTok LIVE Studio)" })],
        })
      );
    }

    // Safe zone with widget docks
    const safeZone = el("div", { class: "tg-safe-zone" });
    const dockNodes: Record<Dock, HTMLDivElement> = Object.fromEntries(
      DOCKS.map((d) => [d, el("div", { class: `tg-dock tg-dock--${d}` })])
    ) as Record<Dock, HTMLDivElement>;
    DOCKS.forEach((d) => safeZone.appendChild(dockNodes[d]));

    for (const widgetId of def.widgets) {
      if (!widgetIsActiveInScene(widgetId, def.id, config)) continue;
      const factory = WIDGET_REGISTRY[widgetId];
      if (!factory) continue;
      const widget = factory();
      const dock = config.widgetDocks[widgetId] ?? "top-left";
      const scale = config.widgetScale[widgetId] ?? 1;
      const color = config.widgetColors[widgetId];
      widget.node.style.setProperty("--widget-scale", String(scale));
      widget.node.classList.add("tg-widget-slot");
      if (color) widget.node.style.setProperty("--color-primary", color);
      dockNodes[dock].appendChild(widget.node);
      widget.onConfig?.(config);
      activeWidgets.push(widget);
    }
    stage.appendChild(safeZone);

    if (extras.showSocials) safeZone.appendChild(socialsPanel(config));

    // CTA zone (vertical formats)
    if (def.ctaZone) {
      const ctaMessages = ["LIKE POUR BOOSTER L'ÉNERGIE", "FOLLOW POUR REJOINDRE L'ÉQUIPE", "DAMA READY — ON EST ENSEMBLE"];
      const ctaEl = el("span", { class: "tg-cta__text", text: ctaMessages[0] });
      stage.appendChild(el("div", { class: "tg-cta", children: [ctaEl] }));
      if (!config.reducedMotion) {
        let i = 0;
        const t = window.setInterval(() => {
          i = (i + 1) % ctaMessages.length;
          ctaEl.classList.add("tg-cta__text--swap");
          window.setTimeout(() => {
            ctaEl.textContent = ctaMessages[i];
            ctaEl.classList.remove("tg-cta__text--swap");
          }, 260);
        }, 5000);
        unsubscribers.push(() => window.clearInterval(t));
      }
    }
  }

  // Hero centerpiece (Starting Soon, BRB, Ending, Victory, Defeat, Transition…)
  const mascot = new Mascot(extras.mascotState ?? "idle");
  if (extras.heroTitle) {
    mascot.node.classList.add("tg-hero__mascot");
    stage.appendChild(
      el("div", {
        class: "tg-hero",
        children: [
          mascot.node,
          el("div", {
            class: "tg-hero__text",
            children: [
              el("span", { class: "tg-hero__title", text: extras.heroTitle }),
              extras.heroSubtitle ? el("span", { class: "tg-hero__subtitle", text: extras.heroSubtitle }) : null,
            ],
          }),
        ],
      })
    );
  } else if (!def.clean) {
    mascot.node.classList.add("tg-corner-mascot");
    stage.appendChild(mascot.node);
  }

  mountAlertManager(stage);

  const offEvent = eventBus.on((message) => {
    if (message.kind !== "event") return;
    const reaction = MASCOT_REACTION[message.event.type];
    if (reaction && !extras.heroTitle) {
      const prev = mascot.current ?? "idle";
      void mascot.set(reaction.state);
      window.setTimeout(() => void mascot.set(prev), reaction.holdMs);
    }
    for (const widget of activeWidgets) widget.onEvent?.(message.event);
  });
  unsubscribers.push(offEvent);

  const offConfig = configStore.subscribe((c) => {
    particles.setProfile(c.performanceProfile, c.reducedMotion);
    applyPerformance({ profile: c.performanceProfile, reducedMotion: c.reducedMotion });
    for (const widget of activeWidgets) widget.onConfig?.(c);
  });
  unsubscribers.push(offConfig);

  return () => {
    particles.stop();
    for (const widget of activeWidgets) widget.destroy?.();
    for (const off of unsubscribers) off();
  };
}
