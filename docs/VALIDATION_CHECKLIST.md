# Checklist de validation

Utilisez cette liste avant un stream, ou après une personnalisation importante.

- [ ] **Format Twitch testé en 1920×1080** — ouvrez `/?scene=twitch-gameplay-webcam&layout=horizontal`, vérifiez l'identité (logo/pseudo), le webcam-guide, les widgets et les particules.
- [ ] **Format TikTok testé en 1080×1920** — ouvrez `/?scene=tiktok-gameplay-webcam&layout=vertical`, vérifiez que rien n'empiète sur la zone de sécurité haute/basse et que le CTA tourne.
- [ ] **Panneau `/control` fonctionnel** — le statut de connexion passe à "Connecté au bus local" dans les 2 secondes suivant l'ouverture d'une scène overlay dans un autre onglet.
- [ ] **Alertes simulées et file d'attente testées** — déclenchez Follow, Sub, Gift (les 3 paliers), Raid, Like Goal, Victory, Defeat et Energy Full depuis `/control` ; déclenchez-en plusieurs d'affilée et vérifiez qu'elles s'affichent une par une, jamais superposées.
- [ ] **Thèmes et profils de performance testés** — passez par les 5 thèmes depuis `/control` et vérifiez que les couleurs changent partout sans recharger la page ; passez le profil de performance en `low` et vérifiez que les particules disparaissent.
- [ ] **README et procédure OBS/TikTok fournis** — `README.md`, `docs/OBS_SETUP.md`, `docs/TIKTOK_LIVE_STUDIO_SETUP.md`.
- [ ] **Aucun secret dans le dépôt** — `config/streamer.json` ne contient que des données de personnalisation publiques (pseudo, objectifs, réseaux) ; aucun token/clé API n'est requis pour faire fonctionner le projet.
- [ ] **Lisibilité mobile vérifiée** — ouvrez une scène verticale sur un écran de téléphone (ou un viewport réduit dans le navigateur) et vérifiez que le texte reste lisible et qu'au plus 3 informations importantes s'affichent simultanément.
- [ ] **Démarrage en moins de 15 minutes** — `npm install && npm run dev` suffit ; aucune configuration de compte, clé d'API ou service tiers n'est requise pour voir toutes les scènes fonctionner.
- [ ] **Mascotte et emblème cohérents entre les thèmes** — les 7 états de la mascotte et les 4 variantes de l'emblème s'affichent correctement sous les 5 thèmes (les SVG utilisent les variables de couleur, pas de couleurs figées).
