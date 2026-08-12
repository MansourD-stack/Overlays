import { el } from "@/core/dom";
import { mountInlineSvg } from "./InlineSvg";

export type MascotState =
  | "idle"
  | "happy"
  | "shocked"
  | "angry"
  | "sleep"
  | "fire"
  | "glasses";

const ASSET: Record<MascotState, string> = {
  idle: "/assets/mascot/mascot-idle.svg",
  happy: "/assets/mascot/mascot-happy.svg",
  shocked: "/assets/mascot/mascot-shocked.svg",
  angry: "/assets/mascot/mascot-angry.svg",
  sleep: "/assets/mascot/mascot-sleep.svg",
  fire: "/assets/mascot/mascot-fire.svg",
  glasses: "/assets/mascot/mascot-glasses.svg",
};

/**
 * Baobab-circuit mascot. States map to stream moments: idle (default),
 * happy (follow/like bursts), shocked (big gift), angry (rage/clutch loss),
 * sleep (BRB), fire (victory), glasses (huge gift / boss defeated).
 */
export class Mascot {
  readonly node: HTMLDivElement;
  private state: MascotState | null = null;

  constructor(initial: MascotState = "idle") {
    this.node = el("div", { class: "tg-mascot", attrs: { "data-state": initial } });
    this.set(initial);
  }

  async set(state: MascotState) {
    if (this.state === state) return;
    this.state = state;
    this.node.setAttribute("data-state", state);
    this.node.classList.add("tg-mascot--swap");
    await mountInlineSvg(this.node, ASSET[state]);
    requestAnimationFrame(() => this.node.classList.remove("tg-mascot--swap"));
  }

  get current() {
    return this.state;
  }
}
