import { el } from "@/core/dom";
import { configStore } from "@/core/configLoader";
import { pushConfig } from "../bridge";
import { textField, numberField } from "./fields";

export function textGoalEditorPanel(): HTMLElement {
  const c = configStore.get();

  const identity = el("div", {
    class: "tg-ctrl-grid",
    children: [
      textField("Pseudo", c.pseudo, (v) => pushConfig({ pseudo: v })),
      textField("Communauté", c.communityName, (v) => pushConfig({ communityName: v })),
      textField("Tagline", c.tagline, (v) => pushConfig({ tagline: v })),
      textField("Jeu actuel", c.game, (v) => pushConfig({ game: v })),
      textField("Twitch", c.socials.twitch, (v) => pushConfig({ socials: { twitch: v } })),
      textField("TikTok", c.socials.tiktok, (v) => pushConfig({ socials: { tiktok: v } })),
      textField("YouTube", c.socials.youtube, (v) => pushConfig({ socials: { youtube: v } })),
    ],
  });

  const goals = el("div", {
    class: "tg-ctrl-grid",
    children: [
      numberField("Followers actuels", c.goals.followers.current, (v) => pushConfig({ goals: { followers: { current: v } } })),
      numberField("Followers objectif", c.goals.followers.target, (v) => pushConfig({ goals: { followers: { target: v } } })),
      numberField("Likes actuels", c.goals.likes.current, (v) => pushConfig({ goals: { likes: { current: v } } })),
      numberField("Likes objectif", c.goals.likes.target, (v) => pushConfig({ goals: { likes: { target: v } } })),
      numberField("Cadeaux actuels", c.goals.gifts.current, (v) => pushConfig({ goals: { gifts: { current: v } } })),
      numberField("Cadeaux objectif", c.goals.gifts.target, (v) => pushConfig({ goals: { gifts: { target: v } } })),
      numberField("Dons actuels (F)", c.goals.donations.current, (v) => pushConfig({ goals: { donations: { current: v } } })),
      numberField("Dons objectif (F)", c.goals.donations.target, (v) => pushConfig({ goals: { donations: { target: v } } })),
    ],
  });

  const match = el("div", {
    class: "tg-ctrl-grid",
    children: [
      numberField("Score équipe", c.score.team, (v) => pushConfig({ score: { team: v } })),
      numberField("Score adversaire", c.score.opponent, (v) => pushConfig({ score: { opponent: v } })),
      numberField("Manches gagnées", c.score.roundsWon, (v) => pushConfig({ score: { roundsWon: v } })),
      numberField("Manches totales", c.score.roundsTotal, (v) => pushConfig({ score: { roundsTotal: v } })),
      numberField("Classement", c.ranking.position, (v) => pushConfig({ ranking: { position: v } })),
      numberField("Sur (classement)", c.ranking.of, (v) => pushConfig({ ranking: { of: v } })),
    ],
  });

  return el("section", {
    class: "tg-ctrl-panel",
    children: [
      el("h2", { class: "tg-ctrl-panel__title", text: "Identité, objectifs & score" }),
      el("h3", { class: "tg-ctrl-subtitle", text: "Identité & réseaux" }),
      identity,
      el("h3", { class: "tg-ctrl-subtitle", text: "Objectifs" }),
      goals,
      el("h3", { class: "tg-ctrl-subtitle", text: "Score & classement" }),
      match,
    ],
  });
}
