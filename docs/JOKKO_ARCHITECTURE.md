# Jokko — architecture technique (MVP v1)

Jokko est la plateforme construite autour du système d'overlays de ce dépôt : un streamer sénégalais crée son compte, ajoute son overlay dans OBS / TikTok LIVE Studio, partage sa page de soutien, et ses fans le soutiennent via **Wave, Orange Money ou Free Money**. Chaque paiement confirmé déclenche automatiquement une alerte sur l'overlay.

> **Marques.** « Teranga Squad » reste l'identité personnelle du streamer fondateur. Jokko est une marque à part (logo `public/assets/jokko/jokko-mark.svg`, palette indigo/sable, polices système) : l'overlay d'un streamer Jokko affiche **son** nom et **sa** communauté, jamais ceux du fondateur.

## Les 7 composants

```
 Fan (téléphone)                         Streamer
   │                                        │
   ▼                                        ▼
 ① Page de soutien /s/<slug>        ⑤ Tableau de bord /dashboard
   │  POST /api/public/.../payments         │  historique, solde, retrait, réglages
   ▼                                        │
 ② Serveur Jokko (server/) ◄────────────────┘
   │   ├─ ③ Fournisseur de paiement (PayDunya | simulé)
   │   │      checkout → webhook (IPN) → re-confirmation API
   │   ├─ ④ Stockage (data/jokko.json)
   │   └─ ⑥ Relais temps réel /overlay-bridge (1 canal par streamer)
   ▼                                        ▲
 ⑦ Overlay Browser Source (/?scene=…&key=…) ─┘  + panneau /control
```

| # | Composant | Code |
|---|---|---|
| ① | Page de soutien fan (mobile, thème du streamer) | `support.html`, `src/jokko/support/` |
| ② | Serveur HTTP/API (Node, sans framework) | `server/app.ts`, `server/http.ts` |
| ③ | Agrégateurs de paiement (interface commune) | `server/payments/` |
| ④ | Stockage persistant (JSON atomique, remplaçable) | `server/store.ts` |
| ⑤ | Tableau de bord streamer | `dashboard.html`, `src/jokko/dashboard/` |
| ⑥ | Relais WebSocket par canal | `server/realtime.ts` |
| ⑦ | Overlay + panneau de contrôle (existants) | `src/`, `index.html`, `control.html` |

Le serveur est le **seul** point qui parle à la fois à l'agrégateur, à l'overlay et au panneau de contrôle.

### Une seule commande

- **Développement / usage local** : `npm run dev` — Vite sert toutes les pages et le plugin `jokko-server` (`vite.config.ts`) greffe l'API, les webhooks et le relais sur le même port (5173).
- **Production** : `npm run build && npm start` — `server/main.ts` sert le build (`dist/`), l'API et le relais sur `PORT` (8080 par défaut).

Le même code serveur tourne dans les deux cas.

## Parcours d'un paiement

1. Le fan choisit montant + moyen sur `/s/<slug>` → `POST /api/public/streamers/<slug>/payments`.
2. Le serveur valide (montant entier entre `JOKKO_MIN_AMOUNT` et `JOKKO_MAX_AMOUNT`, numéro sénégalais facultatif), modère le message (liens retirés, mots bloqués masqués, 140 caractères), calcule la commission selon l'offre, crée la facture chez l'agrégateur et renvoie l'URL de paiement.
3. Le fan valide sur l'écran de l'agrégateur (ou le simulateur `/pay/sim/<ref>` en mode test), puis revient sur `/s/<slug>?ref=…`.
4. L'agrégateur notifie `POST /api/webhooks/<fournisseur>`. PayDunya : hash SHA-512 de la clé principale vérifié **puis** statut re-confirmé par l'API et montant comparé.
5. Pendant ce temps la page du fan interroge `GET /api/public/payments/<ref>` toutes les 1,5 s ; si le webhook tarde, le serveur interroge lui-même l'agrégateur (au plus toutes les 3 s) — la confirmation reste sous les 10 s.
6. À la confirmation (une seule fois, idempotent) : crédit du fan pour son Rang Teranga, puis publication sur le canal du streamer d'un événement `donation` (alerte) et d'un `config-patch` (jauge d'objectif, dernier soutien).

## Rang Teranga (boucle de fidélité)

Un fan qui renseigne son numéro est identifié par un **HMAC** du numéro (clé serveur) — le numéro n'est jamais stocké en clair. Le total de ses dons, **tous streamers Jokko confondus**, donne son rang : Bronze (dès le 1er don), Argent (10 000 F), Or (50 000 F), Diamant (200 000 F) — `server/ranks.ts`. Le rang s'affiche sur l'alerte, dans l'historique du streamer et sur l'écran de confirmation du fan (« plus que X F pour le rang suivant »). Les rangs de test et réels sont séparés.

## Modèle de données (`data/jokko.json`)

| Collection | Contenu |
|---|---|
| `streamers` | compte (e-mail, hash scrypt), slug, offre `free`/`pro`, clé d'overlay, thème, page de soutien, objectif, modération, numéro Wave de retrait |
| `sessions` | SHA-256 du jeton de session (le jeton lui-même n'est que dans le cookie HttpOnly) |
| `payments` | montant, moyen, commission, net, statut, fournisseur, `livemode`, nom/message du fan, clé fan |
| `withdrawals` | demandes de retrait (montant, numéro Wave, statut `pending`/`paid`/`rejected`) |
| `fans` | total cumulé, nombre de dons, streamers soutenus |

Le stockage est un fichier JSON écrit de façon atomique (fichier temporaire + renommage). C'est volontaire pour un MVP installable en minutes ; tout accès passe par `Store`, donc migrer vers PostgreSQL/SQLite ne touche qu'un fichier. **Limite : un seul processus serveur.**

## Argent test vs argent réel

`livemode` n'est vrai qu'avec PayDunya en mode `live`. Chaque paiement, retrait et rang porte son `livemode` ; soldes, jauges et rangs ne comptent que les enregistrements du mode courant. De l'argent de test ne peut donc jamais être retiré comme de l'argent réel.

## Sécurité

- **Aucun secret dans le dépôt** : clés PayDunya, secret serveur et jeton admin viennent de variables d'environnement (`.env`, ignoré par git) ; à défaut, un secret aléatoire est généré dans `data/secret.key` (ignoré aussi).
- Mots de passe : scrypt salé. Sessions : jeton aléatoire 256 bits, cookie `HttpOnly; SameSite=Lax` (+ `Secure` si `JOKKO_PUBLIC_URL` est en HTTPS).
- CSRF : toute écriture authentifiée exige `Content-Type: application/json` et une origine identique.
- Pages argent/compte servies avec `X-Frame-Options: DENY`.
- Clé d'overlay **en lecture seule** : une URL d'overlay qui fuite permet de regarder l'overlay, jamais d'injecter une fausse alerte. Seul le streamer connecté (ou le serveur) publie sur son canal. Clé régénérable depuis le tableau de bord.
- Limitation de débit : création de paiement (10/min/IP), connexion, inscription, suivi de statut. `JOKKO_TRUST_PROXY=1` derrière un reverse proxy.
- Tout texte venant d'un fan est rendu via `textContent`, jamais en HTML.

## API (résumé)

| Méthode | Route | Accès |
|---|---|---|
| GET | `/api/public/streamers/:slug` | public |
| POST | `/api/public/streamers/:slug/payments` | public (limité) |
| GET | `/api/public/payments/:ref` | public (référence non devinable) |
| POST | `/api/webhooks/:provider` | agrégateur (signature vérifiée) |
| GET | `/api/overlay/state?key=` | clé d'overlay |
| POST | `/api/auth/signup` · `/login` · `/logout` | — |
| GET | `/api/dashboard` | streamer connecté |
| PATCH | `/api/settings` | streamer connecté |
| PUT | `/api/payout` | streamer connecté (numéro Wave) |
| POST | `/api/withdrawals` | streamer connecté |
| POST | `/api/overlay/rotate-key` · `/api/overlay/test-alert` | streamer connecté |
| GET/POST | `/api/admin/withdrawals[/:id]`, `/api/admin/streamers/:slug/plan` | `Authorization: Bearer $JOKKO_ADMIN_TOKEN` |
| GET/POST | `/api/sim/payments/:ref[/confirm]` | mode test uniquement |

## Correspondance avec le cahier des charges

| Exigence MVP | Où |
|---|---|
| Choix Wave / Orange Money / Free Money, montants suggérés + libre, message | page de soutien |
| Confirmation < 10 s | webhook + re-vérification active (`PaymentService.refresh`) ; mesuré à ~0,3 s en simulation |
| Scène Gameplay avec alerte de don temps réel | `donationAlert` (`src/alerts/alertViews.ts`), 3 paliers |
| Jauge d'objectif (dons cumulés) | widget `goalDonations` |
| Thème Dakar Neon via variables CSS ; OBS et TikTok LIVE Studio | inchangé, URL `?key=` |
| Historique, solde, demande de retrait, connexion Wave | tableau de bord |
| PayDunya + webhook, aucun secret dans le code | `server/payments/paydunya.ts`, `.env.example` |
| Inscription → overlay affiché en < 15 min | parcours « Démarrer en 3 étapes » du tableau de bord |
| Offres Gratuit (1 thème, commission plus élevée) / Pro | `plan`, `JOKKO_COMMISSION_FREE/PRO`, thèmes filtrés |
| V2 déjà amorcée | 5 thèmes, scènes H/V, mascotte, Énergie Teranga, Boss Fight, Radar (existants) ; Rang Teranga inter-streamers |

## Ce qui n'est pas (encore) fait

- **Versement automatique des retraits** : les demandes sont enregistrées et traitées par un administrateur (virement Wave manuel puis `POST /api/admin/withdrawals/:id`). L'API de déboursement de l'agrégateur est l'étape suivante, une fois le montage juridique validé.
- **« Connexion à un compte Wave »** = enregistrement du numéro Wave de retrait ; Wave n'offre pas de connexion OAuth publique aux comptes particuliers.
- **Paiement direct sans redirection (SoftPay)** : le MVP utilise la page de paiement hébergée par PayDunya, restreinte au moyen choisi par le fan.
- Organisation multi-profils, reporting consolidé, second agrégateur de secours (l'interface `PaymentProvider` est prête pour CinetPay / Hub2).
- Base de données multi-processus, e-mails de réinitialisation de mot de passe.
