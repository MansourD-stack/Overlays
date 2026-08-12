# Flaa's Squad Overlays — Afro-Future

Système d'overlays premium pour un streamer gaming sénégalais, pensé pour **Twitch, TikTok LIVE, YouTube et Kick**. Direction visuelle : **Baobab Circuit** — le baobab réinterprété en circuit imprimé futuriste, énergie de Dakar, esthétique e-sport. Voir [`docs/ARCHITECTURE_AND_VISUAL_DIRECTIONS.md`](docs/ARCHITECTURE_AND_VISUAL_DIRECTIONS.md) pour l'architecture complète et les 3 directions visuelles envisagées.

## Démarrage rapide (moins de 15 minutes)

```bash
npm install
npm run dev
```

Ouvrez :
- **http://localhost:5173/control** — le panneau de contrôle (jamais visible dans vos scènes de stream)
- **http://localhost:5173/?scene=twitch-gameplay-webcam&layout=horizontal** — une scène horizontale (Twitch/YouTube/Kick)
- **http://localhost:5173/?scene=tiktok-gameplay-webcam&layout=vertical** — une scène verticale (TikTok LIVE)

Ajoutez ces URLs comme **Browser Source** dans OBS ou TikTok LIVE Studio — voir [`docs/OBS_SETUP.md`](docs/OBS_SETUP.md) et [`docs/TIKTOK_LIVE_STUDIO_SETUP.md`](docs/TIKTOK_LIVE_STUDIO_SETUP.md).

Une seule commande fait tout tourner : Vite sert les deux pages (overlay + panneau de contrôle) et un petit relais WebSocket local (greffé sur le même serveur) synchronise le panneau de contrôle avec toutes les scènes ouvertes — pas de second process, pas de backend séparé.

## Fonctionnalités

- **23 scènes** : 11 horizontales (1920×1080) + 12 verticales (1080×1920), chacune pensée séparément (pas une simple réduction de l'autre).
- **5 thèmes** interchangeables sans toucher au code : Dakar Neon, Flaa's Fire, Atlantic Cyber, Tournament, Night Mode.
- **18 widgets** indépendants : activables, déplaçables (position en "dock"), redimensionnables et recolorables depuis `/control`.
- **Alertes en file d'attente** : follow, abonnement, cadeaux (3 paliers), raid/host, vague de likes, Mode Flaa's Activé — jamais deux alertes superposées.
- **Jauge d'énergie** : monte avec les follows/cadeaux/likes/victoires, avec activation spectaculaire à 100 %.
- **Mode Boss Fight** : barre de vie, phases, état de danger.
- **Mascotte SVG à 7 états** (idle, happy, shocked, angry, sleep, fire, glasses) et **emblème** exportable en plusieurs variantes.
- **Panneau de contrôle local** (`/control`) : changement de scène/thème en direct, édition des objectifs/textes, simulateur d'alertes, gestion des widgets, réglages de performance.
- **Mode simulation complet** : aucune dépendance à une API TikTok non documentée — tous les événements peuvent être testés localement.
- **3 profils de performance** (low / balanced / ultra) + `reducedMotion`.

## Structure du projet

```
config/streamer.json      Personnalisation (pseudo, objectifs, thème, webcam…) — le fichier à éditer en premier
src/themes/                5 thèmes = 5 fichiers CSS de variables
src/core/                  config, router, bus d'événements (WS + simulation), file d'alertes, profils de perf
src/components/            briques visuelles partagées (cadre lumineux, jauge, mascotte, emblème, particules)
src/scenes/horizontal/     11 scènes Twitch/YouTube/Kick
src/scenes/vertical/       12 scènes TikTok LIVE
src/widgets/                18 widgets
src/alerts/                 gestionnaire d'alertes + file d'attente
src/control/                panneau /control
public/assets/               emblème, mascotte (SVG)
public/sounds/                emplacement pour sons optionnels (aucun fichier sous licence fourni)
```

## Documentation

- [Architecture & directions visuelles](docs/ARCHITECTURE_AND_VISUAL_DIRECTIONS.md)
- [Installation OBS](docs/OBS_SETUP.md)
- [Installation TikTok LIVE Studio](docs/TIKTOK_LIVE_STUDIO_SETUP.md)
- [Guide de personnalisation](docs/CUSTOMIZATION.md)
- [Ajouter une scène ou une alerte](docs/ADDING_SCENES_AND_ALERTS.md)
- [Dépannage](docs/TROUBLESHOOTING.md)
- [Checklist de validation](docs/VALIDATION_CHECKLIST.md)

## Sécurité

Aucun secret, token ou clé d'API n'est stocké dans ce dépôt. Le serveur de développement (`npm run dev`) est prévu pour un usage strictement local — ne l'exposez pas sur un réseau non fiable (voir la note dans `docs/TROUBLESHOOTING.md`).
