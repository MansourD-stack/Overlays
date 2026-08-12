import { createLastEventWidget } from "./lastEvent";

export function createLastDonationWidget() {
  return createLastEventWidget({
    id: "lastDonation",
    label: "DERNIER DON",
    matches: ["custom"],
    fallback: "En attente...",
    extract: (p) => (p.kind === "donation" ? String(p.username ?? "") : ""),
  });
}
