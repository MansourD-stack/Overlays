# Jokko — identité de live et soutiens mobile money

**Jokko** donne aux streamers et créateurs live sénégalais (Twitch, TikTok LIVE) une identité de diffusion professionnelle **et** un moyen natif d'être soutenus par leur audience via **Wave, Orange Money et Free Money**. Chaque soutien confirmé s'affiche en direct sur l'overlay.

Le dépôt contient :

- **La plateforme Jokko (MVP v1)** : page de soutien fan, tableau de bord streamer (historique, export CSV, solde, retraits Wave, QR code), paiements via PayDunya (CinetPay en secours) avec webhook, mode test complet sans compte externe, Rang Teranga inter-streamers, console admin, mot de passe oublié, webhook d'intégration Twitch/TikTok.
- **Le système d'overlays Afro-Future** (direction *Baobab Circuit*) : 23 scènes horizontales et verticales, 5 thèmes, 19 widgets, alertes en file d'attente, mascotte, panneau `/control`. Il reste utilisable seul, en local, par le streamer fondateur.

## Démarrage rapide (moins de 15 minutes)

Prérequis : [Node.js 20.12 ou plus récent](https://nodejs.org). Guide pas à pas pour débuter : [docs/GUIDE_LOCAL.md](docs/GUIDE_LOCAL.md).

```bash
npm install
npm run dev
```

Puis ouvre **http://localhost:5173/dashboard** :

1. Crée ton compte (nom de streamer, identifiant, e-mail, mot de passe).
2. Copie l'URL d'overlay proposée et ajoute-la comme **Browser Source** dans OBS (1920×1080) ou TikTok LIVE Studio (1080×1920).
3. Clique sur **Envoyer une alerte de test** : elle apparaît sur ton overlay.
4. Partage ton lien de soutien `http://localhost:5173/s/<ton-identifiant>` et fais un don de test depuis ton téléphone ou un autre onglet.

Sans configuration, tout tourne en **mode test** (paiements simulés, aucun argent réel). Pour brancher PayDunya : [docs/JOKKO_PAIEMENTS.md](docs/JOKKO_PAIEMENTS.md).

> Pour tester depuis un téléphone sur le même Wi-Fi : `VITE_HOST=0.0.0.0 npm run dev`, puis ouvre `http://<ip-de-ton-pc>:5173/s/<identifiant>`.

## Les pages

| URL | Pour qui | Rôle |
|---|---|---|
| `/dashboard` | streamer | inscription, démarrage en 3 étapes, historique, solde, retraits, réglages, URLs d'overlay |
| `/s/<identifiant>` | fans | page de soutien mobile aux couleurs du streamer, confirmation et Rang Teranga |
| `/?scene=…&layout=…&key=…` | OBS / TikTok LIVE Studio | overlay (Browser Source) |
| `/control` | streamer | panneau de contrôle (scènes, thèmes, widgets, simulateur d'alertes) — n'apparaît jamais dans les scènes |
| `/admin` | équipe Jokko | console : retraits à verser, offres Gratuit/Pro, statistiques (jeton `JOKKO_ADMIN_TOKEN`) |
| `/pay/sim/<ref>` | tests | simulateur de paiement (mode test uniquement) |

URLs courtes demandées par le cahier des charges : `/?scene=twitch-gameplay`, `/?scene=tiktok-gameplay`, `/?scene=starting-soon`, `/?scene=brb`, `/?layout=vertical` (le même alias choisit la scène horizontale ou verticale selon `layout`).

## Commandes

| Commande | Usage |
|---|---|
| `npm run dev` | tout-en-un local : pages, API, webhooks, relais temps réel (port 5173) |
| `npm test` | tests du serveur (paiements, webhooks, sécurité, rangs, validation) |
| `npm run typecheck` | vérification TypeScript |
| `npm run build` | build du front (`dist/`) et du serveur (`dist-server/`) |
| `npm start` | serveur de production (port `PORT`, 8080 par défaut) |
| `npm run build:demo` | démo sans serveur (`dist-demo/`) : toutes les pages tournent dans le navigateur, données locales, paiements simulés — pratique pour montrer Jokko sans rien installer |
| `docker build -t jokko .` | image de production (voir [docs/JOKKO_DEPLOIEMENT.md](docs/JOKKO_DEPLOIEMENT.md)) |

## Démo sans installation

`npm run build:demo` produit un dossier statique (`dist-demo/`) que n'importe quel hébergeur de fichiers peut servir. Le serveur y est remplacé par une imitation dans le navigateur (`src/demo/install.ts`) qui reprend les mêmes règles (validation, commission, rangs, retraits) ; les pages ouvertes dans plusieurs onglets restent synchronisées. Compte de démo : `demo@jokko.sn` / `demo1234`, jeton admin `demo-admin`. Rien n'est encaissé, rien n'est envoyé.

## Structure

```
server/                    Serveur Jokko (Node, sans framework)
  app.ts                   routes API, pages, offres, admin
  payments/                agrégateurs (PayDunya, CinetPay, simulé) + cycle de vie des paiements
  hooks.ts, mailer.ts      webhook d'intégration + export CSV, e-mails
  realtime.ts              relais WebSocket, un canal par streamer
  store.ts                 stockage persistant (data/jokko.json)
  auth.ts, validation.ts, ranks.ts
  test/                    tests Vitest
src/jokko/                 tableau de bord, page de soutien, console admin, simulateur (TypeScript + CSS)
src/demo/                  imitation du serveur pour la démo statique (build:demo uniquement)
src/                       overlays : scenes/, widgets/, alerts/, themes/, config/, control/
config/streamer.json       personnalisation du mode local (pseudo, objectifs, thème, webcam…)
public/assets/             emblème, mascotte (SVG), logo Jokko
.env.example               variables d'environnement (à copier en .env, jamais versionné)
```

## Documentation

- [**Travailler en local : installer, modifier, renvoyer ses changements**](docs/GUIDE_LOCAL.md)
- [Architecture Jokko](docs/JOKKO_ARCHITECTURE.md) : composants, parcours d'un paiement, données, sécurité, correspondance avec le cahier des charges
- [Paiements : PayDunya, CinetPay, retraits](docs/JOKKO_PAIEMENTS.md)
- [Mettre en ligne (Render, Railway, Docker, VPS)](docs/JOKKO_DEPLOIEMENT.md)
- [Brancher Twitch / TikTok (Streamer.bot, TikFinity)](docs/JOKKO_INTEGRATIONS.md)
- [Installation OBS](docs/OBS_SETUP.md) · [TikTok LIVE Studio](docs/TIKTOK_LIVE_STUDIO_SETUP.md)
- [Personnalisation](docs/CUSTOMIZATION.md) · [Ajouter une scène ou une alerte](docs/ADDING_SCENES_AND_ALERTS.md)
- [Architecture et directions visuelles des overlays](docs/ARCHITECTURE_AND_VISUAL_DIRECTIONS.md)
- [Dépannage](docs/TROUBLESHOOTING.md) · [Checklist de validation](docs/VALIDATION_CHECKLIST.md)

## Sécurité

Aucun secret, jeton ou clé d'API n'est stocké dans ce dépôt. Les clés PayDunya, le secret serveur et le jeton d'administration viennent de variables d'environnement (`.env` est ignoré par git) ; les données (`data/`) sont ignorées aussi. Détails : [docs/JOKKO_ARCHITECTURE.md#sécurité](docs/JOKKO_ARCHITECTURE.md#sécurité).

> **Avant le premier vrai paiement** : faire valider le statut juridique et les obligations fiscales avec l'agrégateur et un conseil local (voir [docs/JOKKO_PAIEMENTS.md](docs/JOKKO_PAIEMENTS.md)).
