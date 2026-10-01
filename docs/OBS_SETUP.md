# Installation dans OBS Studio

## 0. Avec un compte Jokko (recommandé)

Ouvre `http://localhost:5173/dashboard` (ou l'adresse de ton serveur Jokko), crée ton compte, puis copie les URLs de la carte **Overlay & scènes**. Elles contiennent ta **clé d'overlay** (`&key=…`) : l'overlay affiche alors ton nom, ton thème, ta jauge de dons et les alertes de tes vrais soutiens.

- Toute scène du tableau ci-dessous fonctionne avec ta clé : ajoute simplement `&key=<ta-clé>` à l'URL.
- La clé est en lecture seule (elle ne permet pas d'envoyer de fausses alertes). Si elle a fuité, régénère-la depuis le tableau de bord et remplace l'URL dans OBS.
- Sans clé, l'overlay fonctionne en **mode local** (configuration `config/streamer.json` + panneau `/control`), comme avant Jokko.

## 1. Lancer le projet

```bash
npm install
npm run dev
```

Laissez ce terminal ouvert pendant tout le stream — il sert l'overlay ET fait tourner le relais WebSocket utilisé par `/control`.

## 2. Ajouter une Browser Source par scène

Dans OBS : **Sources → + → Navigateur (Browser Source)**.

Pour chaque scène OBS que vous voulez créer (Gameplay, Just Chatting, BRB, etc.), ajoutez une Browser Source pointant vers l'URL correspondante :

| Scène OBS | URL |
|---|---|
| Starting Soon | `http://localhost:5173/?scene=twitch-starting-soon&layout=horizontal` |
| Gameplay + Webcam | `http://localhost:5173/?scene=twitch-gameplay-webcam&layout=horizontal` |
| Gameplay sans webcam | `http://localhost:5173/?scene=twitch-gameplay-nowebcam&layout=horizontal` |
| Just Chatting | `http://localhost:5173/?scene=twitch-justchatting&layout=horizontal` |
| BRB / Pause | `http://localhost:5173/?scene=twitch-brb&layout=horizontal` |
| Fin de stream | `http://localhost:5173/?scene=twitch-ending&layout=horizontal` |
| Victoire | `http://localhost:5173/?scene=twitch-victory&layout=horizontal` |
| Défaite | `http://localhost:5173/?scene=twitch-defeat&layout=horizontal` |
| Tournoi | `http://localhost:5173/?scene=twitch-tournament&layout=horizontal` |
| Discussion communauté | `http://localhost:5173/?scene=twitch-community&layout=horizontal` |
| Transition de jeu | `http://localhost:5173/?scene=twitch-transition&layout=horizontal` |

**Réglages recommandés de la Browser Source** :
- Largeur : `1920`, Hauteur : `1080`
- Cochez **"Contrôler l'audio via OBS"** si vous ajoutez des sons d'alerte
- Cochez **"Actualiser le navigateur lorsque la scène devient active"** — utile si vous préférez changer de scène via les scènes OBS plutôt que via `/control`
- Laissez **"Arrière-plan transparent"** activé par défaut (l'overlay est transparent nativement, rien à cocher côté OBS)

### Alternative : une seule Browser Source pilotée par `/control`

Plutôt que de multiplier les sources, vous pouvez n'ajouter **qu'une seule** Browser Source (ex. pointée sur `twitch-gameplay-webcam`) et utiliser le bouton **"Afficher"** de chaque scène dans `/control` pour la faire changer en direct, sans recharger la source. C'est le mode recommandé si vous changez souvent de scène en cours de live.

## 3. Positionner votre webcam

L'overlay affiche un **cadre-guide en pointillés** ("WEBCAM (OBS / TikTok LIVE Studio)") à l'endroit où la webcam doit apparaître. Ajoutez votre source **Périphérique de capture vidéo** (votre webcam) comme source séparée, **au-dessus** de la Browser Source dans l'ordre des calques, et alignez-la sur le cadre-guide. Le cadre lui-même ne capture aucune image — c'est un repère visuel.

## 4. Ouvrir le panneau de contrôle

Ouvrez `http://localhost:5173/control` dans un navigateur classique (Chrome/Firefox), sur le même PC — jamais comme Browser Source. C'est depuis cette page que vous changez de scène/thème, simulez des alertes et éditez vos objectifs en direct.

## 5. Ordre des calques recommandé (de haut en bas dans OBS)

1. Alertes / Browser Source overlay (celle-ci contient déjà les alertes, pas besoin d'une source séparée)
2. Webcam (Périphérique de capture vidéo)
3. Browser Source overlay (Flaa's Squad Overlays)
4. Capture de jeu / Capture d'écran

## 6. Build pour un usage sans terminal ouvert en permanence

En développement, `npm run dev` recharge automatiquement au moindre changement de fichier — pratique pour personnaliser l'overlay. Pour un usage figé (aucune modification prévue), vous pouvez aussi construire une version statique :

```bash
npm run build
npm run preview
```

`npm run preview` sert le build de production sur `http://localhost:4173` (le relais WebSocket fonctionne aussi en preview).
