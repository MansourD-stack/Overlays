import { createLastEventWidget } from "./lastEvent";

export function createRaidHostWidget() {
  return createLastEventWidget({
    id: "raidHost",
    label: "RAID / HOST",
    matches: ["raid", "host"],
    fallback: "En attente...",
    extract: (p) => `${p.username ?? ""} (${p.viewers ?? "?"} viewers)`,
  });
}
