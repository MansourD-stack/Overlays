# Guide de personnalisation

## 1. `config/streamer.json` — le point de départ

C'est le fichier à éditer en premier, sans toucher au code :

```json
{
  "pseudo": "Flaa's Squad",
  "communityName": "Flaa's Squad",
  "tagline": "Dama Ready",
  "game": "Free Fire",
  "socials": { "twitch": "...", "tiktok": "...", "youtube": "", "kick": "" },
  "theme": "dakar-neon",
  "performanceProfile": "balanced",
  ...
}
```

`communityName` est repris dans les alertes (« Bienvenue dans la … »), le score et l'écran de fin (`{community}` dans les titres de scène). `goals.donations` alimente le widget **Objectif dons**.

> **Avec un compte Jokko** (overlay ouvert avec `&key=…`), le nom, la communauté, le thème et l'objectif de dons viennent des **réglages du tableau de bord** et priment sur ce fichier. Le reste (widgets, webcam, performance…) continue de se régler ici et dans `/control`.

Après modification, relancez `npm run dev` (ou rechargez la page) — c'est la source des valeurs par défaut. Toute modification faite en direct depuis `/control` est ensuite stockée dans le `localStorage` du navigateur (donc persistante entre deux sessions sur la même machine) et n'écrase jamais ce fichier.

Pour repartir des valeurs par défaut après avoir beaucoup testé depuis `/control`, ouvrez la console du navigateur sur une page overlay ou `/control` et exécutez :
```js
localStorage.removeItem("overlay:config-overrides")
```

## 2. Changer de thème

5 thèmes livrés : `dakar-neon`, `flaas-fire`, `atlantic-cyber`, `tournament`, `night-mode`. Trois façons de choisir un thème, du plus au moins permanent :
1. `config/streamer.json` → `"theme": "..."` (valeur par défaut de toutes les scènes)
2. Panneau `/control` → bouton du thème (change toutes les scènes ouvertes en direct)
3. Paramètre d'URL `&theme=...` sur une scène précise (prioritaire, utile pour une Browser Source qui doit toujours garder un thème fixe même si vous en changez ailleurs)

### Ajouter un 6ᵉ thème

1. Créez `src/themes/mon-theme.css` sur le modèle des fichiers existants (mêmes 9 variables : `--color-background`, `--color-background-alt`, `--color-primary`, `--color-secondary`, `--color-accent`, `--color-text`, `--color-muted`, `--color-danger`, `--color-surface-glass`).
2. Importez-le et ajoutez son nom dans `THEMES`/`THEME_LABELS` dans `src/themes/index.ts`, ainsi que dans `THEMES` de `server/app.ts` (et `THEME_LABELS` de `src/jokko/dashboard/main.ts`) pour le proposer aux streamers Jokko.
3. Il apparaît automatiquement dans le sélecteur de thème de `/control`.

## 3. Widgets : activer, déplacer, redimensionner, recolorer

Tout se fait depuis `/control` → panneau **Widgets**, ou directement dans `config/streamer.json` :
- `widgets.<id>.enabled` : activer/désactiver globalement
- `widgets.<id>.scenes` : liste des scènes où le widget peut apparaître (`["*"]` = toutes)
- `widgetDocks.<id>` : position (`top-left`, `top-center`, `top-right`, `bottom-left`, `bottom-center`, `bottom-right`)
- `widgetScale.<id>` : facteur d'échelle (`1` = taille normale)
- `widgetColors.<id>` : couleur d'accent CSS (ex. `"#ff7a29"`), laissez vide pour suivre le thème actif

## 4. Webcam

`config/streamer.json` → `webcam` :
- `mode` : `"top"` ou `"float"` (scènes verticales uniquement)
- `floatShape` : `"circle"` ou `"hex"`
- `visible` : masque totalement le cadre-guide si `false`

## 5. Mascotte et emblème

- Mascotte : `public/assets/mascot/mascot-<état>.svg`, 7 états (`idle`, `happy`, `shocked`, `angry`, `sleep`, `fire`, `glasses`). Remplacez un fichier SVG en gardant le même nom pour changer son apparence — les couleurs utilisent `currentColor` et les variables de thème, donc un fichier bien fait s'adapte automatiquement aux 5 thèmes.
- Emblème : `public/assets/emblem/emblem-{icon,full-light,full-dark,mono}.svg`.

## 6. Profils de performance

`low` (aucune particule), `balanced` (défaut), `ultra` (effets maximaux) + `reducedMotion` (coupe toutes les animations CSS). Réglables depuis `/control` → panneau **Performance**, ou dans `config/streamer.json`.

## 7. Sons d'alerte

Voir `public/sounds/README.md` — aucun son sous licence n'est fourni, le système fonctionne entièrement en silencieux par défaut.

## 8. Easter eggs

`config/streamer.json` → `easterEggs` : `enabled` (interrupteur général), `dakarMode`, `chatCommand`, `keyCombo`. Ces champs sont exposés comme configuration prête à être branchée sur votre intégration chat/clavier réelle (voir `docs/ADDING_SCENES_AND_ALERTS.md` pour l'exemple de câblage).
