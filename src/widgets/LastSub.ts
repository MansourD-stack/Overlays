import { createLastEventWidget } from "./lastEvent";

export function createLastSubWidget() {
  return createLastEventWidget({
    id: "lastSub",
    label: "DERNIER ABONNÉ",
    matches: ["sub"],
    fallback: "En attente...",
    extract: (p) => String(p.username ?? ""),
  });
}
