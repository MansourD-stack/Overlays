import { el } from "@/core/dom";

export { el };

let toastNode: HTMLDivElement | null = null;
let toastTimer: number | undefined;

export function toast(message: string) {
  if (!toastNode) {
    toastNode = el("div", { class: "jk-toast", attrs: { role: "status", "aria-live": "polite" } });
    document.body.appendChild(toastNode);
  }
  toastNode.textContent = message;
  toastNode.classList.add("jk-toast--on");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastNode?.classList.remove("jk-toast--on"), 2600);
}

export function field(label: string, input: HTMLElement, hint?: string): HTMLLabelElement {
  return el("label", { class: "jk-field", children: [el("span", { text: label }), input, hint ? el("small", { text: hint }) : null] });
}

export function input(attrs: Record<string, string>, value = ""): HTMLInputElement {
  const node = el("input", { class: "jk-input", attrs });
  node.value = value;
  return node;
}

export function button(label: string, variant = "", onClick?: (btn: HTMLButtonElement) => void | Promise<void>): HTMLButtonElement {
  const btn = el("button", { class: `jk-btn ${variant}`.trim(), text: label, attrs: { type: "button" } });
  if (onClick) {
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await onClick(btn);
      } finally {
        btn.disabled = false;
      }
    });
  }
  return btn;
}

export function banner(kind: "test" | "error" | "ok", text: string): HTMLDivElement {
  return el("div", { class: `jk-banner jk-banner--${kind}`, text, attrs: { role: kind === "error" ? "alert" : "status" } });
}

export function progress(current: number, target: number): HTMLDivElement {
  const pct = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const bar = el("div");
  bar.style.width = `${pct}%`;
  return el("div", {
    class: "jk-progress",
    attrs: { role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(target), "aria-valuenow": String(current) },
    children: [bar],
  });
}

/**
 * Two-step button for irreversible actions: the first click arms it (label
 * explains the consequence), the second within 4 s confirms. Replaces
 * window.confirm(), which some embedded browsers silently refuse.
 */
export function confirmButton(label: string, confirmLabel: string, variant: string, onConfirm: () => void | Promise<void>): HTMLButtonElement {
  const btn = el("button", { class: `jk-btn ${variant}`.trim(), text: label, attrs: { type: "button" } });
  let armed = false;
  let timer: number | undefined;
  const disarm = () => {
    armed = false;
    btn.textContent = label;
    btn.classList.remove("jk-btn--armed");
  };
  btn.addEventListener("click", async () => {
    if (!armed) {
      armed = true;
      btn.textContent = confirmLabel;
      btn.classList.add("jk-btn--armed");
      timer = window.setTimeout(disarm, 4000);
      return;
    }
    window.clearTimeout(timer);
    btn.disabled = true;
    try {
      await onConfirm();
    } finally {
      btn.disabled = false;
      disarm();
    }
  });
  return btn;
}
