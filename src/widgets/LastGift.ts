import { createLastEventWidget } from "./lastEvent";

export function createLastGiftWidget() {
  return createLastEventWidget({
    id: "lastGift",
    label: "DERNIER CADEAU",
    matches: ["gift"],
    fallback: "En attente...",
    extract: (p) => `${p.username ?? ""} — ${p.giftName ?? "cadeau"}`,
  });
}
