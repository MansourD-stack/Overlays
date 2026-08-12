# Architecture technique & directions visuelles

## 1. Architecture technique

**Stack** : Vite + TypeScript, Web Components natifs (`customElements`), CSS variables pour le theming, SVG pour l'emblème/la mascotte, Canvas 2D léger pour les particules. Aucun framework UI lourd (React/Vue/Angular) : la surface de l'app (scènes + widgets + panneau de contrôle) est faite de composants DOM ciblés, pas d'une application data-driven complexe — un framework n'apporterait rien qu'on ne puisse faire plus vite en Web Components, tout en gardant un bundle minuscule et un démarrage instantané dans un Browser Source (contrainte de perf critique pour OBS/TikTok LIVE Studio).

**Un seul process, une seule commande** : `npm run dev` lance Vite, qui sert à la fois `index.html` (overlay) et `control.html` (panneau de contrôle) en multi-page build, et un petit relais WebSocket (`vite.config.ts`) est greffé sur le même serveur HTTP pour synchroniser le panneau de contrôle avec toutes les scènes ouvertes (OBS, TikTok LIVE Studio, navigateur de test) — pas de second port, pas de backend séparé à démarrer.

**Routing par URL** (pas de vrai router, juste `URLSearchParams`) :
- `/?scene=twitch-gameplay-webcam&layout=horizontal&theme=dakar-neon`
- `/?scene=tiktok-gameplay&layout=vertical`
- `/?scene=brb`
- `/control` (page séparée, jamais accessible depuis une scène)

**Structure** :
```
config/            streamer.json, scenes.json, widgets.json — la personnalisation sans toucher au code
public/assets/      emblème SVG, mascotte SVG, textures
public/sounds/      emplacement pour sons optionnels (aucun son sous licence fourni)
src/core/           config loader, router, event bus (WS + mode simulation), file d'attente d'alertes, profils de perf
src/themes/         5 thèmes = 5 fichiers CSS de variables, zéro logique
src/components/     briques partagées (cadre lumineux, champ de particules, jauge d'énergie, mascotte, emblème)
src/scenes/horizontal/  et  src/scenes/vertical/   scènes déclaratives + rendu
src/widgets/        widgets indépendants, activables par scène via config/scenes.json
src/alerts/          gestionnaire + composants d'alerte, avec file d'attente
src/control/         panneau /control
```

**Pourquoi data-driven** : chaque scène est une déclaration (quels widgets, quelle disposition webcam, quel texte/CTA) interprétée par un "scene shell" commun (cadre, grille de sécurité, particules, coins découpés). Ça respecte l'exigence "modulaire, évolutif sans tout recoder" — ajouter une scène = ajouter une entrée de config, pas un nouveau système de rendu.

## 2. Trois directions visuelles

### A — Baobab Circuit
Le baobab, silhouette la plus reconnaissable du paysage sénégalais, est réinterprété comme un circuit imprimé : le tronc devient un bus central, les branches des pistes de circuit qui se terminent en feuilles-diodes lumineuses. Les motifs de tissage (wax) sont vectorisés en trames de circuit discrètes utilisées comme texture de fond à faible opacité. La mascotte est un esprit-baobab mécanique (ou un lion cybernétique gardien du baobab). La jauge d'énergie est visuellement la sève/l'énergie qui remonte dans les branches jusqu'à saturation. Emblème : silhouette de baobab-circuit inscrite dans un hexagone légèrement découpé.

### B — Sabar Wave
Direction centrée sur le mouvement : rythme du sabar et vagues de la Corniche de Dakar traduits en ondes néon animées, panneaux à angles dynamiques qui semblent "danser" au rythme des événements (follow, don). Mascotte : esprit d'énergie/djinn du rythme, plus abstrait. Emblème : marque de vague/onde stylisée.

### C — Squad Dashboard
Direction la plus "HUD e-sport pur" : tableau de bord futuriste, grille technique dominante, motifs sénégalais réduits à des accents discrets sur les bordures. Très propre, très compétitif, mais moins narratif/mémorable — le risque est de retomber vers un template e-sport générique.

## 3. Recommandation : Baobab Circuit (A)

C'est la direction retenue et implémentée dans ce projet. Raisons :
- **Reconnaissable en 2 secondes** : la silhouette baobab-circuit + le hexagone de l'emblème sont uniques à cette marque, contrairement à une grille HUD générique (C) qui pourrait appartenir à n'importe quel streamer.
- **Narrativement riche sans cliché** : pas de drapeau, pas de motif touristique — un objet culturel fort réinterprété techniquement, en ligne avec la consigne "subtil, moderne, respectueux".
- **Sert directement les mécaniques demandées** : la mascotte (baobab mécanique/lion cyber), la jauge d'énergie (sève lumineuse), le Mode Boss Fight (le baobab "s'illumine" en mode combat) découlent naturellement du même symbole — cohérence de marque sur tous les livrables.
- **Scalable** : silhouette simple, fonctionne en petite taille (favicon/icône de widget) comme en grand (transition plein écran), et se décline proprement en monochrome/clair/sombre.

Les 5 thèmes (Dakar Neon, Flaa's Fire, Atlantic Cyber, Tournament, Night Mode) sont des palettes de variables CSS appliquées à ce même langage visuel Baobab Circuit — changer de thème ne change jamais la géométrie, seulement les couleurs (`--color-background`, `--color-primary`, `--color-secondary`, `--color-accent`, `--color-text`, `--color-muted`).
