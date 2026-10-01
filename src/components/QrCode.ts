import qrcode from "qrcode-generator";

interface QrOptions {
  /** Dark modules. Keep a strong contrast with `bg`: phones scan dark-on-light best. */
  fg?: string;
  bg?: string;
  /** Quiet zone in modules (the QR spec asks for 4; 2 is fine on a solid card). */
  margin?: number;
  label?: string;
}

/**
 * Renders a QR code as one compact SVG path (no canvas, no raster), so it
 * stays sharp at any Browser Source scale and is cheap to animate in.
 * Used by the dashboard (downloadable) and the overlay's supportQr widget.
 */
export function qrSvgMarkup(text: string, opts: QrOptions = {}): string {
  const { fg = "#0e0d1a", bg = "#ffffff", margin = 2, label = "QR code" } = opts;
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const size = n + margin * 2;
  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) d += `M${c + margin} ${r + margin}h1v1h-1z`;
    }
  }
  const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="${esc(label)}">` +
    `<rect width="${size}" height="${size}" fill="${esc(bg)}"/><path d="${d}" fill="${esc(fg)}"/></svg>`
  );
}

export function qrElement(text: string, cls = "", opts: QrOptions = {}): HTMLElement {
  const wrap = document.createElement("div");
  if (cls) wrap.className = cls;
  wrap.innerHTML = qrSvgMarkup(text, opts); // markup is generated here, every attribute escaped
  return wrap;
}
