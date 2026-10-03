# Générique de fin pour les vidéos

Quatre secondes, format vertical 1080 × 1920, à coller à la fin des vidéos
Instagram et TikTok.

| Fichier | Quand l'utiliser |
|---|---|
| `calbasse-outro.mp4` | fond crème, celui de l'app au repos |
| `calbasse-outro-sombre.mp4` | fond sombre, enchaîne mieux après l'écran de prise de vue |

## Le refaire

Le texte, les couleurs et le rythme sont dans `outro.html`. Pour changer une
phrase, modifie le fichier puis relance :

```bash
cd marketing/video
npm install playwright ffmpeg-static     # une seule fois
CHROME=$(node -p "require('playwright').chromium.executablePath()") node rendre.mjs frames
npx ffmpeg -y -framerate 30 -i frames/%04d.png \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart calbasse-outro.mp4
```

Ajoute `THEME=sombre` devant `node rendre.mjs` pour la version sombre.

Les animations sont mises en pause puis déplacées image par image : le rendu ne
dépend pas de la vitesse de la machine, et deux exécutions donnent exactement le
même fichier.

La police est Plus Jakarta Sans, celle de l'application, copiée depuis
`node_modules/@expo-google-fonts/plus-jakarta-sans/`. Le logo est le même tracé
que `src/components/Logo.tsx`.
