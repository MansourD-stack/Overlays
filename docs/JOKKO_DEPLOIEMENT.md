# Jokko — mettre en ligne

En local (`npm run dev`), Jokko n'est visible que depuis ton ordinateur. Pour que tes fans ouvrent ta page de soutien et que PayDunya ou CinetPay confirment les paiements, le serveur doit être **en ligne, en HTTPS**.

Trois options, de la plus simple à la plus maîtrisée. Dans tous les cas : **un seul processus serveur** et un **disque persistant** pour le dossier des données.

## Variables à définir partout

| Variable | Exemple | Obligatoire |
|---|---|---|
| `JOKKO_PUBLIC_URL` | `https://jokko.ton-domaine.sn` | oui |
| `JOKKO_SECRET` | 64 caractères aléatoires | oui (à sauvegarder, sert aux rangs des fans) |
| `JOKKO_ADMIN_TOKEN` | 40 caractères aléatoires | oui (console `/admin`) |
| `JOKKO_DATA_DIR` | `/data` | oui (disque persistant) |
| `JOKKO_TRUST_PROXY` | `1` | oui derrière Render, Railway, nginx… |
| `JOKKO_PAYMENT_PROVIDER` + clés | `paydunya` | pour encaisser (sinon mode test) |
| `RESEND_API_KEY`, `JOKKO_MAIL_FROM` | | pour « mot de passe oublié » |

Générer un secret : `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

## Option A — Render ou Railway (le plus simple)

1. Pousse le dépôt sur GitHub (déjà fait).
2. Crée un **Web Service** depuis le dépôt :
   - Build : `npm ci && npm run build`
   - Start : `npm start`
   - Ou laisse la plateforme détecter le `Dockerfile`.
3. Ajoute un **disque persistant** monté sur `/data` et mets `JOKKO_DATA_DIR=/data`.
4. Renseigne les variables ci-dessus dans l'onglet *Environment*. `JOKKO_PUBLIC_URL` = l'URL HTTPS fournie par la plateforme (ou ton domaine).
5. Vérifie `https://<ton-url>/api/health` → `{"ok":true,...}`.

> Les offres gratuites qui « s'endorment » sans trafic ne conviennent pas : un webhook de paiement qui arrive sur un serveur endormi peut être retardé. Prends une instance toujours active.

## Option B — Docker sur un VPS

```bash
docker build -t jokko .
docker run -d --name jokko --restart unless-stopped \
  -p 127.0.0.1:8080:8080 \
  -v jokko-data:/data \
  --env-file .env \
  jokko
```

Puis un reverse proxy HTTPS devant (Caddy obtient le certificat tout seul) :

```
jokko.ton-domaine.sn {
  reverse_proxy 127.0.0.1:8080
}
```

Caddy transmet aussi le WebSocket `/overlay-bridge`. Avec nginx, ajoute `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";`.

## Option C — Node directement

```bash
npm ci
npm run build
JOKKO_DATA_DIR=/var/lib/jokko npm start
```

Fais-le tourner avec un gestionnaire de processus (systemd, pm2) et le même reverse proxy HTTPS.

## Sauvegardes

- Le serveur copie automatiquement `jokko.json` dans `data/backups/` au démarrage puis toutes les 24 h, et garde les 14 copies les plus récentes.
- Ces copies sont sur **le même disque** : copie régulièrement `data/backups/` ailleurs (stockage objet, autre serveur).
- Restaurer : arrête le serveur, remplace `data/jokko.json` par une sauvegarde, redémarre.

## Après la mise en ligne

1. Ouvre `https://<ton-url>/dashboard`, crée ton compte et remplace l'URL de la Browser Source dans OBS ou TikTok LIVE Studio par celle du tableau de bord (elle pointe maintenant sur ton serveur en ligne).
2. Ouvre `https://<ton-url>/admin` avec `JOKKO_ADMIN_TOKEN` pour vérifier la console.
3. Fais un paiement en mode test de bout en bout, puis configure PayDunya en sandbox ([JOKKO_PAIEMENTS.md](JOKKO_PAIEMENTS.md)).

La checklist complète avant les vrais paiements est dans [JOKKO_PAIEMENTS.md](JOKKO_PAIEMENTS.md#5-mise-en-production).
