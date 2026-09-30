# Installation dans TikTok LIVE Studio

TikTok LIVE Studio prend en charge les **sources Navigateur/Web** de la même façon qu'OBS (le logiciel est basé sur la même technologie). Le principe est identique : chaque scène verticale est une URL.

## 0. Avec un compte Jokko (recommandé)

Ouvre `http://localhost:5173/dashboard` (ou l'adresse de ton serveur Jokko), crée ton compte, puis copie les URLs de la carte **Overlay & scènes**. Elles contiennent ta **clé d'overlay** (`&key=…`) : l'overlay affiche alors ton nom, ton thème, ta jauge de dons et les alertes de tes vrais soutiens.

- Toute scène du tableau ci-dessous fonctionne avec ta clé : ajoute simplement `&key=<ta-clé>` à l'URL.
- La clé est en lecture seule (elle ne permet pas d'envoyer de fausses alertes). Si elle a fuité, régénère-la depuis le tableau de bord et remplace l'URL dans TikTok LIVE Studio.
- Sans clé, l'overlay fonctionne en **mode local** (configuration `config/streamer.json` + panneau `/control`), comme avant Jokko.

## 1. Lancer le projet

```bash
npm install
npm run dev
```

## 2. Ajouter une source Web par scène verticale

Dans TikTok LIVE Studio : **Sources → Ajouter → Navigateur/Web**.

| Scène | URL |
|---|---|
| Gameplay | `http://localhost:5173/?scene=tiktok-gameplay&layout=vertical` |
| Gameplay + Webcam | `http://localhost:5173/?scene=tiktok-gameplay-webcam&layout=vertical` |
| Facecam | `http://localhost:5173/?scene=tiktok-facecam&layout=vertical` |
| Just Chatting | `http://localhost:5173/?scene=tiktok-justchatting&layout=vertical` |
| Starting Soon | `http://localhost:5173/?scene=tiktok-starting-soon&layout=vertical` |
| Pause | `http://localhost:5173/?scene=tiktok-pause&layout=vertical` |
| Fin de live | `http://localhost:5173/?scene=tiktok-ending&layout=vertical` |
| Challenge | `http://localhost:5173/?scene=tiktok-challenge&layout=vertical` |
| Objectif likes | `http://localhost:5173/?scene=tiktok-likes-goal&layout=vertical` |
| Objectif cadeaux | `http://localhost:5173/?scene=tiktok-gifts-goal&layout=vertical` |
| Duel / Battle | `http://localhost:5173/?scene=tiktok-battle&layout=vertical` |
| Clip moment fort (épuré) | `http://localhost:5173/?scene=tiktok-clip&layout=vertical` |

**Réglages recommandés** : largeur `1080`, hauteur `1920`.

## 3. Zone de sécurité TikTok

L'interface TikTok LIVE (pseudo, commentaires, boutons like/cadeau) recouvre le haut et le bas de l'écran. Toutes les scènes verticales respectent déjà une **zone de sécurité** (aucun widget ni texte important dans ces bandes) — vous n'avez rien à configurer, mais évitez de repositionner un widget manuellement tout en haut ou tout en bas de l'écran depuis `/control` si vous voulez garder cette garantie.

## 4. Webcam : deux modes

Dans `/control` → panneau **Webcam**, choisissez :
- **`top`** : la webcam occupe une bande en haut de l'écran (sous le pseudo/logo).
- **`float`** : la webcam est une fenêtre flottante circulaire ou hexagonale (réglable via **Forme**), positionnée en haut à droite.

Comme pour OBS, l'overlay affiche un **cadre-guide** — alignez votre source webcam TikTok LIVE Studio dessus.

## 5. Panneau de contrôle

Ouvrez `http://localhost:5173/control` dans un navigateur séparé (pas dans TikTok LIVE Studio) pour piloter vos scènes, objectifs et alertes en direct pendant le live.

## 6. Bonnes pratiques verticales

- Utilisez la scène **Clip moment fort** (`tiktok-clip`) pour les séquences intenses que vous comptez découper en clip — elle n'affiche aucun texte, seulement le HUD minimal.
- Les CTA ("LIKE POUR BOOSTER L'ÉNERGIE", "FOLLOW POUR REJOINDRE L'ÉQUIPE") tournent automatiquement toutes les 5 secondes ; désactivez `reducedMotion` uniquement si vous voulez les figer.
