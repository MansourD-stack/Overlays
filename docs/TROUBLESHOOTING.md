# Dépannage

## L'overlay reste vide / transparent dans OBS ou le navigateur

- Vérifiez que `npm run dev` tourne toujours dans un terminal (ou que `npm start` tourne après un `npm run build`).
- Vérifiez l'URL : le paramètre `scene` doit correspondre à un id existant (voir les tableaux dans `docs/OBS_SETUP.md` / `docs/TIKTOK_LIVE_STUDIO_SETUP.md`). Un id inconnu retombe silencieusement sur une scène par défaut plutôt que d'afficher une erreur.
- Dans OBS, essayez **clic droit sur la source → Actualiser**.

## Le panneau `/control` affiche "Hors ligne — relance npm run dev"

- Le relais WebSocket local tourne sur le même port que Vite (`5173` par défaut) — assurez-vous qu'aucune autre application n'utilise déjà ce port.
- Si vous avez modifié `server.port` dans `vite.config.ts`, rechargez `/control` après le redémarrage du serveur.
- Ce statut n'empêche pas `/control` de fonctionner en local dans le même onglet, mais aucune scène overlay ouverte séparément ne recevra vos actions tant que la connexion n'est pas rétablie.

## Les changements de `/control` n'apparaissent pas sur la scène OBS

- Vérifiez que la Browser Source OBS pointe bien vers `http://localhost:...` (pas un fichier local `file://`) — le relais WebSocket a besoin d'une vraie connexion HTTP.
- Le panneau `/control` et la scène overlay doivent être ouverts en même temps pendant le changement (le bus ne mémorise pas les actions passées pour les scènes qui se connectent plus tard, à l'exception du thème/objectifs qui sont aussi persistés en `localStorage`).

## Les scènes verticales sont recouvertes par l'interface TikTok

- Ne déplacez pas manuellement un widget tout en haut (`top-*`) ou tout en bas (`bottom-*`) de l'écran au-delà de ce que prévoit déjà la zone de sécurité — voir `--safe-zone-v-top` / `--safe-zone-v-bottom` dans `src/themes/tokens.css`.

## Les performances chutent (particules, glow)

- Passez le profil de performance sur `low` depuis `/control` → panneau **Performance**, ou activez `reducedMotion`.
- `low` désactive complètement les particules ; `balanced` (défaut) est prévu pour tourner confortablement sur une machine de stream typique en tâche de fond d'OBS/TikTok LIVE Studio.

## `npm run build` échoue avec des erreurs TypeScript

- Le projet type-check avant de builder (`tsc --noEmit`) — lisez le message d'erreur, il pointe le fichier et la ligne exacts. La cause la plus fréquente après une modification manuelle de `config/streamer.json` est un champ manquant ou mal typé (comparez avec `src/types/index.ts` → `StreamerConfig`).

## Sécurité du serveur de développement

`npm run dev` utilise Vite en mode développement, prévu pour un usage **strictement local** (le même ordinateur qui fait tourner OBS/TikTok LIVE Studio). Ne l'exposez pas sur un réseau public ou non fiable : comme tout serveur de dev basé sur esbuild/Vite, il fait confiance aux requêtes provenant du navigateur qui s'y connecte. Pour un usage figé ou un serveur accessible à des fans, utilise `npm run build` + `npm start` (voir `docs/JOKKO_PAIEMENTS.md`, section mise en production).

## Jokko : aucune alerte de don n'apparaît sur l'overlay

- L'URL de la Browser Source contient-elle `&key=…` ? Copie-la depuis le tableau de bord (carte **Overlay & scènes**). Si tu as régénéré la clé, l'ancienne URL ne reçoit plus rien.
- Clique **Alerte de test** dans le tableau de bord : si elle s'affiche, l'overlay est bien branché et le problème vient du paiement (voir ci-dessous).
- Les alertes passent une par une : plusieurs dons rapprochés s'affichent à la suite, jamais superposés.
- Les messages des fans ne s'affichent pas ? Vérifie **Réglages → Modération → Afficher les messages**.

## Jokko : le paiement reste « Confirmation en cours… »

- Mode test : le fan doit cliquer **Valider le paiement** sur l'écran du simulateur.
- PayDunya : `JOKKO_PUBLIC_URL` doit être une adresse HTTPS joignable depuis internet (tunnel en local), sinon le webhook n'arrive jamais. Le serveur interroge aussi PayDunya directement pendant que la page du fan attend ; si ça bloque encore, regarde les messages `[jokko]` dans le terminal.
- Un paiement marqué **Échoué** alors que le fan a payé : le montant confirmé par PayDunya ne correspondait pas (message « montant incohérent » dans le terminal). À vérifier dans le tableau de bord PayDunya.

## Jokko : « Trop de tentatives. Patiente une minute. »

- La création de paiement est limitée à 10 par minute et par adresse IP. Derrière un reverse proxy, définis `JOKKO_TRUST_PROXY=1`, sinon tous les fans partagent la même limite.

## Jokko : le panneau `/control` ne pilote pas mon overlay avec clé

- Ouvre `/control` dans le **même navigateur** où tu es connecté au tableau de bord : il rejoint alors ton canal Jokko. Sans connexion, il pilote uniquement les overlays sans clé (mode local).

## Repartir de zéro

```bash
localStorage.clear()   # dans la console du navigateur, sur une page overlay ou /control
```
Cela efface toutes les modifications faites depuis `/control` et fait revenir chaque champ à sa valeur définie dans `config/streamer.json`.
