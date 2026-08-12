# Ajouter une scène, un widget ou une alerte

Le système est **data-driven** : ajouter une scène ne demande jamais de nouveau système de rendu, seulement une nouvelle entrée déclarative.

## Ajouter une scène

1. Ouvrez `src/scenes/horizontal/registry.ts` (ou `src/scenes/vertical/registry.ts`).
2. Ajoutez un objet au tableau exporté :

```ts
{
  id: "twitch-ma-nouvelle-scene",   // doit être unique, utilisé dans l'URL ?scene=
  layout: "horizontal",
  title: "Ma nouvelle scène",
  description: "Ce qu'elle affiche.",
  webcamSlot: "corner",              // "none" | "top" | "corner" | "float" | "full"
  ctaZone: false,                     // true uniquement pour les scènes verticales avec CTA
  clean: false,                       // true = aucun widget/texte, juste le fond + particules
  widgets: ["lastFollower", "score"], // ids du registre de widgets à afficher
  // Optionnel — centre la scène sur un message plutôt que sur les widgets :
  heroTitle: "MON TITRE",
  heroSubtitle: "Sous-titre",
  mascotState: "idle",
}
```

3. C'est tout — la scène est immédiatement accessible via `/?scene=twitch-ma-nouvelle-scene&layout=horizontal` et apparaît dans `/control`.

## Ajouter un widget

1. Créez `src/widgets/MonWidget.ts` retournant un objet conforme à `Widget` (`src/widgets/types.ts`) :

```ts
import { glowFrame } from "@/components/GlowFrame";
import type { Widget } from "./types";

export function createMonWidget(): Widget {
  const node = glowFrame({ class: "tg-widget", variant: "chip", children: [/* … */] });
  return {
    id: "monWidget",
    node,
    onConfig(config) { /* mettre à jour l'affichage depuis la config */ },
    onEvent(event) { /* réagir à un événement temps réel */ },
  };
}
```

2. Enregistrez-le dans `src/widgets/registry.ts` (`WIDGET_REGISTRY.monWidget = createMonWidget`).
3. Ajoutez une entrée `monWidget` dans `config/streamer.json` → `widgets`, `widgetDocks`, etc.
4. Ajoutez `"monWidget"` à la liste `widgets` de n'importe quelle scène pour l'activer.

## Ajouter un type d'alerte

Les alertes utilisent le même bus d'événements que la simulation (`TerangaEventType` dans `src/types/index.ts`). Pour un événement totalement nouveau, le plus simple est de passer par le type `"custom"` avec un `payload.kind` dédié (c'est déjà le mécanisme utilisé par le message important, les dons, la vague de likes et les viewers) :

```ts
eventBus.send({ kind: "event", event: makeEvent("custom", { kind: "mon-evenement", ... }) });
```

Puis, dans `src/alerts/AlertManager.ts`, ajoutez un cas ou une nouvelle vue dans `src/alerts/alertViews.ts` qui construit le rendu (`node`, `durationMs`), et poussez l'événement dans `alertQueue` (ou traitez-le hors file, comme la vague de likes, s'il doit pouvoir se chevaucher avec les autres).

Pour un vrai nouveau `TerangaEventType` (pas un `custom`), ajoutez-le à l'union dans `src/types/index.ts`, puis câblez-le dans `AlertManager.ts` (`QUEUEABLE` + `buildView`).

## Brancher un easter egg réel (commande chat / combinaison de touches)

`config/streamer.json` → `easterEggs` définit la configuration (activé, commande chat, combinaison de touches) mais reste indépendant de toute plateforme précise. Pour le brancher :
- **Commande chat** : dans votre intégration chat (bot Twitch/TikTok que vous ajoutez séparément), quand vous détectez `easterEggs.chatCommand`, envoyez `eventBus.send({ kind: "event", event: makeEvent("custom", { kind: "dakar-mode" }) })` vers le bridge (ou simulez-le depuis `/control`).
- **Combinaison de touches** : ajoutez un `keydown` listener dans `src/main.ts` qui compare la combinaison à `configStore.get().easterEggs.keyCombo` et déclenche le même événement `custom`.
- Traitez ensuite `kind: "dakar-mode"` où vous voulez (ex. dans `AlertManager.ts` pour une animation plein écran, ou dans `shell.ts` pour un changement de thème temporaire).

## Bus d'événements et types de messages

Tout passe par `src/core/eventBus.ts` (`BridgeMessage`, défini dans `src/types/index.ts`) :
- `event` — un événement stream (follow, gift, victory, custom…)
- `config-patch` — une modification de `config/streamer.json` en direct (objectifs, score, webcam…)
- `scene-change`, `theme-change`, `performance-change` — pilotage à distance depuis `/control`

Le bus fonctionne en **mode simulation** même sans aucune plateforme connectée : `/control` et les scènes overlay sont tous des clients du même petit relais WebSocket local (voir `vite.config.ts`).
