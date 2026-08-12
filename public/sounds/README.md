# Sons d'alerte (optionnels)

Aucun fichier audio sous licence n'est fourni dans ce dépôt. Pour activer le son sur une alerte :

1. Déposez un fichier `.mp3`/`.ogg` court (< 2s recommandé) dans ce dossier, par ex. `follow.mp3`, `sub.mp3`, `gift-1.mp3`, `gift-2.mp3`, `gift-3.mp3`, `raid.mp3`, `energy-full.mp3`.
2. Référencez le chemin (`/sounds/follow.mp3`) dans `config/streamer.json` ou directement dans `src/alerts/AlertManager.ts` (voir `SOUND_MAP`).
3. Gardez les niveaux sonores cohérents entre alertes (normalisez autour de -14 LUFS) pour éviter un pic strident pendant un live.

Le système fonctionne sans aucun son : une alerte sans fichier configuré reste silencieuse (visuel seul).
