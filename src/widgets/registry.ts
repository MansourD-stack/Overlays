import type { WidgetFactory } from "./types";
import { createLastFollowerWidget } from "./LastFollower";
import { createLastSubWidget } from "./LastSub";
import { createLastDonationWidget } from "./LastDonation";
import { createLastGiftWidget } from "./LastGift";
import { createRaidHostWidget } from "./RaidHost";
import { createImportantMessageWidget } from "./ImportantMessage";
import { createGoalBarWidget } from "./GoalBar";
import { createViewersWidget } from "./Viewers";
import { createScoreWidget } from "./Score";
import { createRoundsWonWidget } from "./RoundsWon";
import { createRankingWidget } from "./Ranking";
import { createGameInfoWidget } from "./GameInfo";
import { createTimerWidget } from "./Timer";
import { createTerangaRadarWidget } from "./TerangaRadar";
import { createEnergyTerangaWidget } from "./EnergyTeranga";
import { createBossFightWidget } from "./BossFight";
import { createSupportQrWidget } from "./SupportQr";

/** Widget ids here must match the keys used in config/streamer.json's
 *  `widgets` map and in each scene definition's `widgets` list. */
export const WIDGET_REGISTRY: Record<string, WidgetFactory> = {
  lastFollower: createLastFollowerWidget,
  lastSub: createLastSubWidget,
  lastDonation: createLastDonationWidget,
  lastGift: createLastGiftWidget,
  raidHost: createRaidHostWidget,
  importantMessage: createImportantMessageWidget,
  goalFollowers: () => createGoalBarWidget("goalFollowers", "followers"),
  goalLikes: () => createGoalBarWidget("goalLikes", "likes"),
  goalGifts: () => createGoalBarWidget("goalGifts", "gifts"),
  goalDonations: () => createGoalBarWidget("goalDonations", "donations"),
  viewers: createViewersWidget,
  score: createScoreWidget,
  roundsWon: createRoundsWonWidget,
  ranking: createRankingWidget,
  gameInfo: createGameInfoWidget,
  timer: createTimerWidget,
  terangaRadar: createTerangaRadarWidget,
  energyTeranga: createEnergyTerangaWidget,
  bossFight: createBossFightWidget,
  supportQr: createSupportQrWidget,
};

export const WIDGET_IDS = Object.keys(WIDGET_REGISTRY);

/** Human-readable names for the control panel's widget manager — the
 *  internal ids stay stable (used by config/scenes) even if this label changes. */
export const WIDGET_LABELS: Record<string, string> = {
  lastFollower: "Dernier follower",
  lastSub: "Dernier abonné",
  lastDonation: "Dernier don",
  lastGift: "Dernier cadeau",
  raidHost: "Raid / Host",
  importantMessage: "Message important",
  goalFollowers: "Objectif followers",
  goalLikes: "Objectif likes",
  goalGifts: "Objectif cadeaux",
  goalDonations: "Objectif dons (Jokko)",
  viewers: "Viewers",
  score: "Score",
  roundsWon: "Manches gagnées",
  ranking: "Classement",
  gameInfo: "Jeu en cours",
  timer: "Chronomètre / session",
  terangaRadar: "Radar (mini dashboard)",
  energyTeranga: "Jauge d'énergie",
  bossFight: "Boss Fight",
  supportQr: "QR code de soutien (Jokko)",
};
