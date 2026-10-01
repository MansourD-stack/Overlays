# Jokko — brancher Twitch et TikTok (follows, abonnements, cadeaux)

Les **dons** arrivent tout seuls sur l'overlay : ils passent par Jokko. Les autres événements (follows Twitch, abonnements, raids, cadeaux et likes TikTok) viennent des plateformes elles-mêmes. Jokko ne dépend d'aucune API TikTok non documentée : il reçoit ces événements depuis l'outil que tu utilises déjà, via ton **URL de webhook**.

## Ton URL de webhook

Tableau de bord → carte **Intégrations Twitch / TikTok** → copie l'URL :

```
https://<ton-serveur>/api/hooks/hk_xxxxxxxxxxxxxxxx
```

Elle est **secrète** : quiconque la connaît peut déclencher des animations sur ton overlay (jamais des dons). Ne la montre pas en stream. En cas de fuite : **Régénérer l'URL**.

## Format

`POST` avec un corps JSON, ou `GET` avec les mêmes champs en paramètres d'URL.

| `type` | Champs | Effet sur l'overlay |
|---|---|---|
| `follow` | `username` | alerte follow, widget « Dernier follower » |
| `sub` | `username` | alerte abonnement (emblème) |
| `gift` | `username`, `giftName`, `coins` ou `tier` (1-3) | alerte cadeau ; palier calculé : < 100 pièces → 1, < 1000 → 2, sinon 3 |
| `raid` / `host` | `username`, `viewers` | portail raid |
| `victory` / `defeat` | — | écran victoire / défaite |
| `like_wave` | — | vague de likes |
| `likes` | `total` | met à jour la jauge « Objectif likes » |
| `viewers` | `count` | compteur de viewers |
| `message` | `text` | message important (modéré : liens retirés, mots bloqués masqués) |

Exemples :

```bash
curl -X POST "$HOOK" -H "Content-Type: application/json" -d '{"type":"follow","username":"Awa"}'
curl -X POST "$HOOK" -H "Content-Type: application/json" -d '{"type":"gift","username":"Modou","giftName":"Lion","coins":500}'
curl "$HOOK?type=likes&total=4200"
```

Limite : 60 appels par 10 secondes par URL.

## Streamer.bot (Twitch, YouTube, Kick, TikTok via TikFinity)

1. Crée une **Action** déclenchée par l'événement voulu (Twitch → Follow, Subscription, Raid…).
2. Ajoute une sous-action **Core → Network → Fetch URL** (méthode POST si disponible, sinon GET).
3. URL : `ton-webhook?type=follow&username=%user%` (adapte les variables Streamer.bot : `%user%`, `%viewers%`…).

## TikFinity (TikTok LIVE)

1. *Actions & Events* → nouvelle action → **Webhook** (ou « Call URL »).
2. URL : `ton-webhook?type=gift&username={username}&giftName={giftname}&coins={coins}` (les noms exacts des variables sont listés dans TikFinity).
3. Associe l'action à l'événement (Gift, Follow, Like…).

## Streamlabs Desktop / autres

Tout outil capable d'appeler une URL à chaque événement convient. À défaut, le panneau `/control` permet de déclencher chaque alerte à la main.

## Plus tard

Une connexion native Twitch (EventSub) évitera l'outil intermédiaire pour Twitch. Elle demande une application Twitch déclarée et une connexion OAuth du streamer : prévue après la validation du MVP.
