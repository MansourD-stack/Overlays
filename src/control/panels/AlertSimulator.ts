import { el } from "@/core/dom";
import { eventBus } from "@/core/eventBus";
import { makeEvent } from "@/core/makeEvent";
import { pushConfig } from "../bridge";
import { configStore } from "@/core/configLoader";

const SAMPLE_NAMES = ["Awa", "Modou", "Fatou", "Ibrahima", "Khady", "Cheikh", "Astou", "Ousmane"];
function randomName() {
  return SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)];
}

function testButton(label: string, onClick: () => void, variant = ""): HTMLButtonElement {
  const btn = el("button", { class: `tg-ctrl-btn tg-ctrl-btn--test ${variant}`.trim(), text: label });
  btn.addEventListener("click", onClick);
  return btn;
}

export function alertSimulatorPanel(): HTMLElement {
  const requiredButtons = [
    testButton("Follow", () => eventBus.send({ kind: "event", event: makeEvent("follow", { username: randomName() }) })),
    testButton("Sub", () => eventBus.send({ kind: "event", event: makeEvent("sub", { username: randomName() }) })),
    testButton("Gift", () => eventBus.send({ kind: "event", event: makeEvent("gift", { username: randomName(), giftName: "Rose", tier: 1 }) })),
    testButton("Raid", () => eventBus.send({ kind: "event", event: makeEvent("raid", { username: randomName(), viewers: 42 }) })),
    testButton(
      "Like Goal",
      () => {
        const c = configStore.get();
        pushConfig({ goals: { likes: { current: c.goals.likes.target } } });
        eventBus.send({ kind: "event", event: makeEvent("like_goal", {}) });
      },
      "tg-ctrl-btn--accent"
    ),
    testButton("Victory", () => eventBus.send({ kind: "event", event: makeEvent("victory", {}) }), "tg-ctrl-btn--victory"),
    testButton("Defeat", () => eventBus.send({ kind: "event", event: makeEvent("defeat", {}) }), "tg-ctrl-btn--defeat"),
    testButton(
      "Energy Full",
      () => {
        const c = configStore.get();
        pushConfig({ energyTeranga: { current: c.energyTeranga.max } });
        eventBus.send({ kind: "event", event: makeEvent("energy_full", {}) });
      },
      "tg-ctrl-btn--accent"
    ),
  ];

  // Gift tiers 2 & 3 aren't in the mandatory list but are core to the spec (3 intensity levels).
  const giftTiers = el("div", {
    class: "tg-ctrl-row",
    children: [
      el("span", { class: "tg-ctrl-row__title", text: "Cadeaux — paliers" }),
      testButton("Tier 1", () => eventBus.send({ kind: "event", event: makeEvent("gift", { username: randomName(), giftName: "Rose", tier: 1 }) })),
      testButton("Tier 2", () => eventBus.send({ kind: "event", event: makeEvent("gift", { username: randomName(), giftName: "Couronne", tier: 2 }) })),
      testButton("Tier 3", () => eventBus.send({ kind: "event", event: makeEvent("gift", { username: randomName(), giftName: "Lion Cyber", tier: 3 }) })),
    ],
  });

  const hostRow = el("div", {
    class: "tg-ctrl-row",
    children: [el("span", { class: "tg-ctrl-row__title", text: "Host" }), testButton("Host", () => eventBus.send({ kind: "event", event: makeEvent("host", { username: randomName(), viewers: 18 }) }))],
  });

  const messageInput = el("input", { class: "tg-ctrl-input", attrs: { type: "text", placeholder: "Message important à afficher…" } });
  const sendMessageBtn = testButton("Envoyer le message", () => {
    if (!messageInput.value.trim()) return;
    eventBus.send({ kind: "event", event: makeEvent("custom", { kind: "message", text: messageInput.value.trim() }) });
    messageInput.value = "";
  });

  const viewersInput = el("input", { class: "tg-ctrl-input", attrs: { type: "number", value: "120", min: "0" } });
  const sendViewersBtn = testButton("Mettre à jour viewers", () => {
    eventBus.send({ kind: "event", event: makeEvent("custom", { kind: "viewers", count: Number(viewersInput.value) || 0 }) });
  });

  const likeWaveBtn = testButton("Déclencher vague de likes", () => {
    eventBus.send({ kind: "event", event: makeEvent("custom", { kind: "like_wave" }) });
  });

  const donationInput = el("input", { class: "tg-ctrl-input", attrs: { type: "text", placeholder: "Nom du donateur" } });
  const donationAmount = el("select", {
    class: "tg-ctrl-input",
    children: [500, 1000, 2500, 5000, 15000].map((a) => el("option", { text: `${a} F`, attrs: { value: String(a) } })),
  });
  const sendDonationBtn = testButton("Simuler don Jokko", () => {
    const amount = Number(donationAmount.value);
    const methods = [["wave", "Wave"], ["orange-money", "Orange Money"], ["free-money", "Free Money"]];
    const [method, methodLabel] = methods[Math.floor(Math.random() * methods.length)];
    const ranks = [["bronze", "Bronze"], ["argent", "Argent"], ["or", "Or"], ["diamant", "Diamant"]];
    const [rankId, rankLabel] = ranks[Math.floor(Math.random() * ranks.length)];
    const c = configStore.get();
    pushConfig({ goals: { donations: { current: c.goals.donations.current + amount } } });
    eventBus.send({
      kind: "event",
      event: makeEvent("donation", {
        username: donationInput.value.trim() || randomName(),
        amount,
        currency: "XOF",
        method,
        methodLabel,
        message: "Nio far ! Continue comme ça 🔥",
        rank: { id: rankId, label: rankLabel },
        test: true,
      }),
    });
    donationInput.value = "";
  });

  return el("section", {
    class: "tg-ctrl-panel",
    children: [
      el("h2", { class: "tg-ctrl-panel__title", text: "Simulateur d'alertes" }),
      el("p", { class: "tg-ctrl-panel__hint", text: "Aucune connexion externe requise — ces boutons émettent de vrais événements sur le bus local." }),
      el("div", { class: "tg-ctrl-btn-row", children: requiredButtons }),
      giftTiers,
      hostRow,
      el("div", { class: "tg-ctrl-row", children: [el("span", { class: "tg-ctrl-row__title", text: "Message important" }), messageInput, sendMessageBtn] }),
      el("div", { class: "tg-ctrl-row", children: [el("span", { class: "tg-ctrl-row__title", text: "Viewers" }), viewersInput, sendViewersBtn] }),
      el("div", { class: "tg-ctrl-row", children: [el("span", { class: "tg-ctrl-row__title", text: "Don mobile money" }), donationInput, donationAmount, sendDonationBtn] }),
      el("div", { class: "tg-ctrl-row", children: [likeWaveBtn] }),
    ],
  });
}
