/**
 * Rang Teranga — a fan's rank grows with everything they have given across
 * ALL Jokko streamers, not just one. This is the retention loop of the spec:
 * a rank earned with one streamer is visible on every other streamer's overlay.
 */
export type RankId = "bronze" | "argent" | "or" | "diamant";

export interface Rank {
  id: RankId;
  label: string;
  min: number;
}

export const RANKS: Rank[] = [
  { id: "bronze", label: "Bronze", min: 0 },
  { id: "argent", label: "Argent", min: 10_000 },
  { id: "or", label: "Or", min: 50_000 },
  { id: "diamant", label: "Diamant", min: 200_000 },
];

export function rankFor(total: number): Rank {
  let current = RANKS[0];
  for (const rank of RANKS) if (total >= rank.min) current = rank;
  return current;
}

export function nextRank(total: number): { rank: Rank; missing: number } | null {
  const next = RANKS.find((r) => r.min > total);
  return next ? { rank: next, missing: next.min - total } : null;
}
