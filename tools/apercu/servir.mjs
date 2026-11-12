/**
 * Sert un export web (`npx expo export --platform web`) en local, pour l'ouvrir dans un
 * navigateur. `--iso` ajoute les en-têtes d'isolation de netlify.toml, pour reproduire la
 * production au plus près.
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const [racine, port] = [process.argv[2] ?? 'dist', Number(process.argv[3] ?? 8080)];
const isole = process.argv.includes('--iso');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.css': 'text/css', '.ttf': 'font/ttf' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let fichier = path.join(racine, decodeURIComponent(url.pathname));
  let corps;
  // Les routes de l'app sortent en fichiers « nom.html » ; tout le reste retombe sur l'accueil.
  for (const essai of [fichier, `${fichier}.html`, path.join(racine, 'index.html')]) {
    try { corps = await readFile(essai); fichier = essai; break; } catch { /* suivant */ }
  }
  if (!corps) { res.writeHead(404); return res.end(); }
  const entetes = { 'Content-Type': TYPES[path.extname(fichier)] ?? 'application/octet-stream' };
  if (isole) {
    entetes['Cross-Origin-Opener-Policy'] = 'same-origin';
    entetes['Cross-Origin-Embedder-Policy'] = 'require-corp';
  }
  res.writeHead(200, entetes);
  res.end(corps);
}).listen(port, '127.0.0.1', () => console.error(`export servi sur ${port}`));
