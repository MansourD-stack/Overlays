import { createLastEventWidget } from "./lastEvent";
import { formatCompactNumber } from "@/core/dom";

export function createLastDonationWidget() {
  return createLastEventWidget({
    id: "lastDonation",
    label: "DERNIER DON",
    matches: ["donation", "custom"],
    fallback: "En attente...",
    extract: (p) => {
      if (p.kind === "donation") return String(p.username ?? ""); // legacy custom event
      if (p.amount === undefined) return "";
      return `${String(p.username ?? "")} · ${formatCompactNumber(Number(p.amount))} F`;
    },
  });
}
