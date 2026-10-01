/**
 * Every link between Jokko pages goes through here. The real server serves
 * clean URLs (/dashboard, /s/<slug>, /pay/sim/<ref>); the browser-only demo
 * build (VITE_JOKKO_DEMO=1) is a set of static files with relative paths.
 */
const DEMO = import.meta.env.VITE_JOKKO_DEMO === "1";

export const IS_DEMO = DEMO;

export const paths = {
  asset: (p: string) => `${import.meta.env.BASE_URL}${p.replace(/^\/+/, "")}`,
  dashboard: () => (DEMO ? "dashboard.html" : "/dashboard"),
  admin: () => (DEMO ? "admin.html" : "/admin"),
  control: () => (DEMO ? "control.html" : "/control"),
  support: (slug: string) => (DEMO ? `support.html?slug=${encodeURIComponent(slug)}` : `/s/${encodeURIComponent(slug)}`),
  supportPreview: (slug: string) => (DEMO ? `…/support.html?slug=${slug}` : `${location.host}/s/${slug}`),
  /** Slug of the support page being viewed. */
  currentSlug: () =>
    DEMO ? new URLSearchParams(location.search).get("slug") ?? "awa-gaming" : decodeURIComponent(location.pathname.split("/")[2] ?? ""),
  /** Payment reference on the test checkout page. */
  currentSimRef: () => (DEMO ? new URLSearchParams(location.search).get("ref") ?? "" : decodeURIComponent(location.pathname.split("/")[3] ?? "")),
};
