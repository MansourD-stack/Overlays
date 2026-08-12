type Props = {
  class?: string;
  attrs?: Record<string, string>;
  text?: string;
  html?: string;
  children?: (Node | null | undefined | false)[];
};

/** Tiny DOM builder — keeps every component free of a template-compiler dependency. */
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props = {}): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) node.setAttribute(k, v);
  if (props.text !== undefined) node.textContent = props.text;
  if (props.html !== undefined) node.innerHTML = props.html;
  if (props.children) for (const child of props.children) if (child) node.appendChild(child);
  return node;
}

export function svgUse(href: string, cls = ""): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  if (cls) svg.setAttribute("class", cls);
  const use = document.createElementNS(ns, "use");
  use.setAttributeNS("http://www.w3.org/1999/xlink", "href", href);
  svg.appendChild(use);
  return svg;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function formatCompactNumber(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}
