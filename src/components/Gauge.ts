import { el, clamp } from "@/core/dom";

interface GaugeOptions {
  label: string;
  cls?: string;
  showValue?: (current: number, max: number) => string;
}

/** Generic labeled progress bar — backs the energy gauge, the Boss
 *  Fight HP bar, and every follower/like/gift goal widget. One visual
 *  primitive, several meanings driven by the caller. */
export class Gauge {
  readonly node: HTMLDivElement;
  private fill: HTMLDivElement;
  private valueEl: HTMLSpanElement;
  private labelEl: HTMLSpanElement;

  constructor(private opts: GaugeOptions) {
    this.labelEl = el("span", { class: "tg-gauge__label", text: opts.label });
    this.valueEl = el("span", { class: "tg-gauge__value" });
    this.fill = el("div", { class: "tg-gauge__fill" });
    this.node = el("div", {
      class: `tg-gauge ${opts.cls ?? ""}`.trim(),
      children: [
        el("div", { class: "tg-gauge__head", children: [this.labelEl, this.valueEl] }),
        el("div", { class: "tg-gauge__track", children: [this.fill] }),
      ],
    });
  }

  update(current: number, max: number) {
    const pct = clamp(max > 0 ? (current / max) * 100 : 0, 0, 100);
    this.fill.style.width = `${pct}%`;
    this.node.setAttribute("data-full", pct >= 100 ? "true" : "false");
    this.valueEl.textContent = this.opts.showValue ? this.opts.showValue(current, max) : `${current}/${max}`;
  }

  setLabel(label: string) {
    this.labelEl.textContent = label;
  }
}
