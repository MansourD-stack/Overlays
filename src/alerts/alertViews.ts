import { el } from "@/core/dom";
import { Mascot } from "@/components/Mascot";
import { emblem } from "@/components/Emblem";
import type { TerangaEvent } from "@/types";

export interface AlertView {
  node: HTMLElement;
  durationMs: number;
  onMount?(): void;
}

function name(event: TerangaEvent, fallback = "Quelqu'un"): string {
  return String(event.payload.username ?? fallback);
}

export function followAlert(event: TerangaEvent): AlertView {
  const node = el("div", {
    class: "tg-alert tg-alert--follow",
    children: [
      el("div", { class: "tg-alert__glow" }),
      emblem("icon", "tg-alert__emblem"),
      el("div", {
        class: "tg-alert__body",
        children: [
          el("span", { class: "tg-alert__title", text: "NOUVEAU FOLLOW" }),
          el("span", { class: "tg-alert__name", text: name(event) }),
          el("span", { class: "tg-alert__sub", text: "Bienvenue dans la Flaa's Squad" }),
        ],
      }),
    ],
  });
  return { node, durationMs: 5000 };
}

export function subAlert(event: TerangaEvent): AlertView {
  const mascot = new Mascot("happy");
  mascot.node.classList.add("tg-alert__mascot");
  const node = el("div", {
    class: "tg-alert tg-alert--sub",
    children: [
      el("div", { class: "tg-alert__glow" }),
      mascot.node,
      el("div", {
        class: "tg-alert__body",
        children: [
          el("span", { class: "tg-alert__title", text: "NOUVEL ABONNÉ" }),
          el("span", { class: "tg-alert__name", text: name(event) }),
          el("span", { class: "tg-alert__sub", text: "Emblème activé — Nio Far !" }),
        ],
      }),
    ],
  });
  return { node, durationMs: 6000 };
}

const GIFT_TIER_CLASS: Record<number, string> = { 1: "tg-alert--gift-1", 2: "tg-alert--gift-2", 3: "tg-alert--gift-3" };

export function giftAlert(event: TerangaEvent): AlertView {
  const tier = Number(event.payload.tier ?? 1) as 1 | 2 | 3;
  const giftName = String(event.payload.giftName ?? "cadeau");
  const fullscreen = tier === 3;
  const mascot = new Mascot(tier === 3 ? "glasses" : "shocked");
  mascot.node.classList.add("tg-alert__mascot");
  const node = el("div", {
    class: `tg-alert tg-alert--gift ${GIFT_TIER_CLASS[tier]} ${fullscreen ? "tg-alert--fullscreen" : ""}`,
    children: [
      el("div", { class: "tg-alert__glow" }),
      mascot.node,
      el("div", {
        class: "tg-alert__body",
        children: [
          el("span", { class: "tg-alert__title", text: `CADEAU TIER ${tier}` }),
          el("span", { class: "tg-alert__name", text: `${name(event)} — ${giftName}` }),
        ],
      }),
    ],
  });
  return { node, durationMs: fullscreen ? 7000 : 4500 };
}

export function raidAlert(event: TerangaEvent): AlertView {
  const isHost = event.type === "host";
  const node = el("div", {
    class: "tg-alert tg-alert--raid tg-alert--fullscreen",
    children: [
      el("div", { class: "tg-alert__portal" }),
      el("div", {
        class: "tg-alert__body",
        children: [
          el("span", { class: "tg-alert__title", text: isHost ? "HOST REÇU" : "RAID ENTRANT" }),
          el("span", { class: "tg-alert__name", text: name(event) }),
          el("span", { class: "tg-alert__sub", text: `L'escouade débarque — ${event.payload.viewers ?? "?"} viewers` }),
        ],
      }),
    ],
  });
  return { node, durationMs: 6500 };
}

export function likeWaveAlert(): AlertView {
  const node = el("div", {
    class: "tg-alert tg-alert--like-wave",
    children: [el("div", { class: "tg-alert__wave" }), el("span", { class: "tg-alert__title", text: "VAGUE DE LIKES" })],
  });
  return { node, durationMs: 3000 };
}

export function victoryAlert(): AlertView {
  const mascot = new Mascot("fire");
  mascot.node.classList.add("tg-alert__mascot", "tg-alert__mascot--large");
  const node = el("div", {
    class: "tg-alert tg-alert--victory tg-alert--fullscreen",
    children: [
      el("div", { class: "tg-alert__glow" }),
      mascot.node,
      el("div", { class: "tg-alert__body", children: [el("span", { class: "tg-alert__title tg-alert__title--xl", text: "VICTOIRE" }), el("span", { class: "tg-alert__sub", text: "On est ensemble" })] }),
    ],
  });
  return { node, durationMs: 5500 };
}

export function defeatAlert(): AlertView {
  const mascot = new Mascot("angry");
  mascot.node.classList.add("tg-alert__mascot");
  const node = el("div", {
    class: "tg-alert tg-alert--defeat tg-alert--fullscreen",
    children: [
      mascot.node,
      el("div", { class: "tg-alert__body", children: [el("span", { class: "tg-alert__title tg-alert__title--xl", text: "DÉFAITE HONORABLE" }), el("span", { class: "tg-alert__sub", text: "On revient plus fort" })] }),
    ],
  });
  return { node, durationMs: 4500 };
}

export function energyFullAlert(): AlertView {
  const mascot = new Mascot("fire");
  mascot.node.classList.add("tg-alert__mascot", "tg-alert__mascot--large");
  const node = el("div", {
    class: "tg-alert tg-alert--energy-full tg-alert--fullscreen",
    children: [
      el("div", { class: "tg-alert__glow" }),
      mascot.node,
      el("div", { class: "tg-alert__body", children: [el("span", { class: "tg-alert__title tg-alert__title--xl", text: "MODE FLAA'S ACTIVÉ" }), el("span", { class: "tg-alert__sub", text: "Dama Ready" })] }),
    ],
  });
  return { node, durationMs: 6000 };
}

export function likeGoalAlert(): AlertView {
  const node = el("div", {
    class: "tg-alert tg-alert--like-goal",
    children: [
      el("div", { class: "tg-alert__glow" }),
      el("div", { class: "tg-alert__body", children: [el("span", { class: "tg-alert__title", text: "OBJECTIF LIKES ATTEINT" }), el("span", { class: "tg-alert__sub", text: "Merci Flaa's Squad" })] }),
    ],
  });
  return { node, durationMs: 4000 };
}
