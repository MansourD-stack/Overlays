import { createLastEventWidget } from "./lastEvent";

export function createLastFollowerWidget() {
  return createLastEventWidget({
    id: "lastFollower",
    label: "DERNIER FOLLOW",
    matches: ["follow"],
    fallback: "En attente...",
    extract: (p) => String(p.username ?? ""),
  });
}
