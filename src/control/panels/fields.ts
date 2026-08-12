import { el } from "@/core/dom";
import { debounce } from "../bridge";

export function textField(label: string, value: string, onChange: (v: string) => void): HTMLElement {
  const input = el("input", { class: "tg-ctrl-input", attrs: { type: "text", value } });
  const commit = debounce(() => onChange(input.value), 250);
  input.addEventListener("input", commit);
  return el("label", { class: "tg-ctrl-field", children: [el("span", { text: label }), input] });
}

export function numberField(label: string, value: number, onChange: (v: number) => void): HTMLElement {
  const input = el("input", { class: "tg-ctrl-input", attrs: { type: "number", value: String(value) } });
  const commit = debounce(() => onChange(Number(input.value) || 0), 250);
  input.addEventListener("input", commit);
  return el("label", { class: "tg-ctrl-field", children: [el("span", { text: label }), input] });
}

export function checkboxField(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  const input = el("input", { attrs: { type: "checkbox" } });
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  return el("label", { class: "tg-ctrl-field tg-ctrl-field--inline", children: [input, el("span", { text: label })] });
}

export function selectField(label: string, value: string, options: string[], onChange: (v: string) => void): HTMLElement {
  const select = el("select", { class: "tg-ctrl-input" });
  for (const opt of options) {
    const o = el("option", { text: opt, attrs: { value: opt } });
    if (opt === value) o.selected = true;
    select.appendChild(o);
  }
  select.addEventListener("change", () => onChange(select.value));
  return el("label", { class: "tg-ctrl-field", children: [el("span", { text: label }), select] });
}

export function rangeField(label: string, value: number, min: number, max: number, step: number, onChange: (v: number) => void): HTMLElement {
  const input = el("input", { class: "tg-ctrl-input", attrs: { type: "range", min: String(min), max: String(max), step: String(step), value: String(value) } });
  const commit = debounce(() => onChange(Number(input.value)), 150);
  input.addEventListener("input", commit);
  return el("label", { class: "tg-ctrl-field", children: [el("span", { text: label }), input] });
}
