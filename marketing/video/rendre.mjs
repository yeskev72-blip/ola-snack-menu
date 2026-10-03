import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const DOSSIER = process.argv[2];
const SECONDES = 4;
const FPS = 30;

rmSync(DOSSIER, { recursive: true, force: true });
mkdirSync(DOSSIER, { recursive: true });

const b = await chromium.launch({ executablePath: process.env.CHROME });
const p = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
await p.goto('file://' + path.resolve('outro/outro.html') + (process.env.THEME ? '#' + process.env.THEME : ''));
await p.waitForTimeout(1200); // laisser les polices se charger

// Les animations sont mises en pause et déplacées image par image : le rendu ne dépend donc
// pas de la vitesse de la machine, et chaque image tombe exactement sur son millième de seconde.
const total = SECONDES * FPS;
for (let i = 0; i < total; i++) {
  await p.evaluate((ms) => {
    for (const a of document.getAnimations()) {
      a.pause();
      a.currentTime = ms;
    }
  }, (i / FPS) * 1000);
  await p.screenshot({ path: `${DOSSIER}/${String(i).padStart(4, '0')}.png` });
}
console.log(total, 'images rendues');
await b.close();
