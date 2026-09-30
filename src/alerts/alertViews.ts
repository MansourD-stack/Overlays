import { el } from "@/core/dom";
import { Mascot } from "@/components/Mascot";
import { emblem } from "@/components/Emblem";
import { configStore } from "@/core/configLoader";
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
          el("span", { class: "tg-alert__sub", text: `Bienvenue dans la ${configStore.get().communityName}` }),
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
      el("div", { class: "tg-alert__body", children: [el("span", { class: "tg-alert__title tg-alert__title--xl", text: "MODE TERANGA ACTIVÉ" }), el("span", { class: "tg-alert__sub", text: "Dama Ready" })] }),
    ],
  });
  return { node, durationMs: 6000 };
}

export function likeGoalAlert(): AlertView {
  const node = el("div", {
    class: "tg-alert tg-alert--like-goal",
    children: [
      el("div", { class: "tg-alert__glow" }),
      el("div", { class: "tg-alert__body", children: [el("span", { class: "tg-alert__title", text: "OBJECTIF LIKES ATTEINT" }), el("span", { class: "tg-alert__sub", text: `Merci ${configStore.get().communityName}` })] }),
    ],
  });
  return { node, durationMs: 4000 };
}

const FCFA = new Intl.NumberFormat("fr-FR");

/** Donation tiers escalate like gifts: small chip → accent card → controlled centre stage. */
export function donationTier(amount: number): 1 | 2 | 3 {
  if (amount >= 10_000) return 3;
  if (amount >= 2_500) return 2;
  return 1;
}

/**
 * Jokko mobile-money donation. Every string coming from a fan is rendered
 * through textContent (via el()), never as HTML; the server has already
 * moderated the message and the streamer can turn messages off entirely.
 */
export function donationAlert(event: TerangaEvent): AlertView {
  const p = event.payload;
  const amount = Number(p.amount ?? 0);
  const tier = donationTier(amount);
  const message = String(p.message ?? "").slice(0, 140);
  const rank = p.rank as { id?: string; label?: string } | null | undefined;
  const mascot = new Mascot(tier === 3 ? "glasses" : "happy");
  mascot.node.classList.add("tg-alert__mascot");
  const chips = el("div", {
    class: "tg-alert__chips",
    children: [
      el("span", { class: "tg-chip tg-chip--method", text: String(p.methodLabel ?? "Mobile money") }),
      rank?.label ? el("span", { class: `tg-chip tg-chip--rank tg-chip--rank-${rank.id ?? "bronze"}`, text: `RANG ${rank.label.toUpperCase()}` }) : null,
      p.test ? el("span", { class: "tg-chip tg-chip--test", text: "TEST" }) : null,
    ],
  });
  const node = el("div", {
    class: `tg-alert tg-alert--donation tg-alert--gift-${tier} ${tier === 3 ? "tg-alert--fullscreen" : ""}`,
    children: [
      el("div", { class: "tg-alert__glow" }),
      mascot.node,
      el("div", {
        class: "tg-alert__body",
        children: [
          el("span", { class: "tg-alert__title", text: "NOUVEAU SOUTIEN" }),
          el("span", { class: "tg-alert__amount", text: `${FCFA.format(amount)} F CFA` }),
          el("span", { class: "tg-alert__name", text: name(event, "Anonyme") }),
          message ? el("span", { class: "tg-alert__message", text: `« ${message} »` }) : null,
          chips,
        ],
      }),
    ],
  });
  // Long enough to read the message on a phone, never long enough to camp on the face cam.
  const durationMs = Math.min(9000, (tier === 3 ? 6500 : 5000) + message.length * 25);
  return { node, durationMs };
}
