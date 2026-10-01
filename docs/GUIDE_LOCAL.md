# Travailler sur Jokko en local

Ce guide part de zéro : installer les outils, lancer l'appli sur ton ordinateur, savoir quel fichier modifier, vérifier que rien n'est cassé, puis renvoyer tes changements sur GitHub.

## 1. Installer les outils (une seule fois)

| Outil | Pourquoi | Où |
|---|---|---|
| **Node.js 22 LTS** (20.12 minimum) | fait tourner l'appli | [nodejs.org](https://nodejs.org) → version « LTS » |
| **Visual Studio Code** | éditer le code | [code.visualstudio.com](https://code.visualstudio.com) |
| **Git** (conseillé) | récupérer et renvoyer le code | [git-scm.com](https://git-scm.com) |

Vérifie dans un terminal :

```bash
node -v    # doit afficher v20.12 ou plus, idéalement v22.x
npm -v
```

## 2. Récupérer le code

**Option A : l'archive .zip.** Décompresse `jokko-source.zip`, puis ouvre un terminal dans le dossier `jokko/`.

**Option B : Git (recommandé pour renvoyer tes changements).**

```bash
git clone -b claude/blissful-meitner-uzi0hb https://github.com/MansourD-stack/Overlays.git jokko
cd jokko
```

Après la fusion de la pull request, utilise la branche de base à la place (voir section 7).

## 3. Lancer l'appli

```bash
npm install      # la première fois, ou après une mise à jour du code
npm run dev
```

Laisse ce terminal ouvert. Puis dans ton navigateur :

| Adresse | Page |
|---|---|
| http://localhost:5173/dashboard | crée ton compte streamer (aucun compte n'existe au départ) |
| http://localhost:5173/s/ton-identifiant | ta page de soutien (paiements simulés) |
| les URLs « Overlay & scènes » du tableau de bord | à ajouter dans OBS / TikTok LIVE Studio |
| http://localhost:5173/control | panneau de contrôle |
| http://localhost:5173/admin | console admin : demande d'abord `JOKKO_ADMIN_TOKEN` (étape 5) |

Les modifications de code s'affichent dès que tu enregistres le fichier (rechargement automatique). Si tu modifies un fichier du dossier `server/`, arrête (`Ctrl+C`) puis relance `npm run dev`.

Tester depuis ton téléphone sur le même Wi-Fi : `VITE_HOST=0.0.0.0 npm run dev`, puis ouvre `http://<ip-de-ton-pc>:5173/s/ton-identifiant`. Sous Windows (PowerShell) : `$env:VITE_HOST="0.0.0.0"; npm run dev`.

Les données (comptes, paiements) sont dans le dossier `data/`. Pour repartir de zéro : arrête le serveur et supprime `data/`.

## 4. Où modifier quoi

| Je veux changer… | Fichier |
|---|---|
| Les textes et la mise en page de la **page de soutien** | `src/jokko/support/main.ts`, `src/jokko/support/support.css` |
| Le **tableau de bord** streamer | `src/jokko/dashboard/main.ts`, `src/jokko/dashboard/dashboard.css` |
| Les couleurs et boutons de la **marque Jokko** | `src/jokko/jokko.css` (variables `--jk-…` en haut) |
| Les **thèmes** de l'overlay (Dakar Neon, Teranga Fire…) | `src/themes/*.css` |
| Les **alertes** (textes, durées, paliers de dons) | `src/alerts/alertViews.ts`, styles dans `src/styles/alerts.css` |
| Les **scènes** (quels widgets dans quelle scène) | `src/scenes/horizontal/registry.ts`, `src/scenes/vertical/registry.ts` |
| Un **widget** (QR code, jauge d'objectif…) | `src/widgets/` (liste dans `src/widgets/registry.ts`) |
| Les réglages du **mode local** (pseudo, jeu, objectifs, positions des widgets) | `config/streamer.json` |
| La **mascotte** et l'**emblème** | `public/assets/mascot/`, `public/assets/emblem/` (SVG) |
| Le **logo Jokko** | `public/assets/jokko/jokko-mark.svg` |
| Les **montants min / max**, le **retrait minimum**, les **commissions** | fichier `.env` (voir étape 5), aucune ligne de code à toucher |
| Les **paliers du Rang Teranga** (Bronze 0, Argent 10 000, Or 50 000, Diamant 200 000) | `server/ranks.ts` |
| Les **montants suggérés** et l'objectif proposés aux nouveaux streamers | `server/app.ts`, route `/api/auth/signup` |
| Les **mots filtrés** d'office dans les messages des fans | `server/validation.ts` (`DEFAULT_BLOCKED`) |
| Les **e-mails** (texte du mot de passe oublié) | `server/app.ts`, route `/api/auth/forgot` |
| Les **paiements** (PayDunya, CinetPay, simulateur) | `server/payments/` |
| Les données de la **démo** sans serveur | `src/demo/install.ts` (fonction `seed`) |

L'architecture complète est décrite dans [JOKKO_ARCHITECTURE.md](JOKKO_ARCHITECTURE.md).

## 5. Configurer (clés, commissions, admin)

Copie `.env.example` en `.env` à la racine du projet, puis décommente et remplis ce dont tu as besoin. Ce fichier n'est **jamais** envoyé sur GitHub.

```ini
# Console /admin en local
JOKKO_ADMIN_TOKEN=un-jeton-long-que-tu-choisis-1234

# Paiements PayDunya en sandbox (sinon : simulateur)
JOKKO_PAYMENT_PROVIDER=paydunya
PAYDUNYA_MODE=test
PAYDUNYA_MASTER_KEY=...
PAYDUNYA_PRIVATE_KEY=...
PAYDUNYA_TOKEN=...
JOKKO_PUBLIC_URL=https://ton-tunnel-https
```

Relance `npm run dev` après chaque modification du `.env`. Détails PayDunya, CinetPay et retraits : [JOKKO_PAIEMENTS.md](JOKKO_PAIEMENTS.md).

## 6. Vérifier avant d'envoyer

```bash
npm test             # 40 tests serveur : paiements, sécurité, rangs, retraits…
npm run typecheck    # erreurs TypeScript
npm run build        # build complet (front + serveur)
```

Les trois doivent passer. Puis refais le parcours à la main : un paiement de test sur ta page de soutien doit afficher l'alerte sur l'overlay. La liste complète est dans [VALIDATION_CHECKLIST.md](VALIDATION_CHECKLIST.md).

Autres commandes utiles :

| Commande | Usage |
|---|---|
| `npm start` | lance la version de production (après `npm run build`), port 8080 |
| `npm run build:demo` | régénère la démo sans serveur dans `dist-demo/` |

## 7. Renvoyer tes changements sur GitHub

Avec Git (option B) :

```bash
git checkout -b ma-modif          # une branche par sujet
git add -A
git commit -m "Change les montants suggérés"
git push -u origin ma-modif
```

Puis ouvre une pull request sur GitHub.

La pull request en cours, [MansourD-stack/Overlays#1](https://github.com/MansourD-stack/Overlays/pull/1), vise la branche `claude/afro-future-teranga-overlays-gvit3m`. Une fois fusionnée, repars de cette branche (ou de `main` si tu fusionnes ensuite dans `main`) :

```bash
git checkout claude/afro-future-teranga-overlays-gvit3m
git pull
```

Si tu as pris l'archive .zip (option A) et veux passer à Git ensuite, fais un `git clone` (option B) dans un autre dossier et recopie-y tes fichiers modifiés.

## 8. Travailler avec Claude Code sur ton ordinateur

Dans le dossier du projet : `claude` dans un terminal. Claude lit alors le code local, lance `npm run dev` et les tests sur ta machine, et peut tester avec OBS ou ton téléphone sur ton réseau.

## Problèmes fréquents

| Symptôme | Solution |
|---|---|
| `npm install` échoue | vérifie `node -v` (20.12 minimum), supprime `node_modules/` et relance |
| « Port 5173 already in use » | un autre `npm run dev` tourne déjà : ferme-le, ou lance `npx vite --port 5174` |
| La page affiche « Hors ligne » dans `/control` | `npm run dev` doit tourner ; recharge la page |
| L'overlay n'affiche pas mes dons | l'URL OBS doit contenir `&key=…` (copie-la depuis le tableau de bord) |
| Je ne vois pas l'e-mail « mot de passe oublié » | sans `RESEND_API_KEY`, le lien s'affiche dans le terminal où tourne `npm run dev` |

Plus de cas : [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
