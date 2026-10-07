import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

/**
 * Enveloppe HTML de la version web, appliquée à chaque page à la construction.
 * https://docs.expo.dev/router/reference/static-rendering/#root-html
 *
 * C'est le seul endroit où déclarer le manifeste et le service worker : sans eux, le navigateur
 * ne propose pas « Installer l'application », et le site reste un site.
 */
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover et user-scalable=no : l'app doit se comporter comme une app, pas
            comme une page qu'on pince pour zoomer. */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
        />
        <meta name="theme-color" content="#C9551F" />
        <meta name="description" content="Photographie ton plat, connais tes calories. Pensée pour la cuisine d'Afrique de l'Ouest." />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        {/* iOS ignore le manifeste : ces deux balises sont ce qui rend l'app plein écran une
            fois ajoutée à l'écran d'accueil depuis Safari. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Calbasse" />

        {/* Sans cela, le défilement de react-native-web se comporte mal sur mobile. */}
        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: fond + demarrageStyles }} />
        <script dangerouslySetInnerHTML={{ __html: enregistrementServiceWorker }} />
      </head>
      <body>
        {/*
          Écrit dans le document, donc peint dès la première image du navigateur — avant que le
          code de l'application soit chargé. C'est cet intervalle qui paraissait long. Retiré en
          fondu par hideBootSplash() quand l'app est prête.
        */}
        <div id="demarrage" aria-hidden="true">
          <div className="demarrage-art">
            <span className="demarrage-anneau" />
            <svg viewBox="0 0 100 100" width="132" height="132">
              <circle cx="50" cy="50" r="46" fill="#9C4A1E" />
              <circle cx="50" cy="50" r="38" fill="#D9A55B" />
              <circle cx="50" cy="50" r="31" fill="#F3D9A4" />
              <ellipse cx="39" cy="38" rx="10" ry="6" fill="#FFF6E3" opacity="0.8" transform="rotate(-35 39 38)" />
            </svg>
          </div>
          <div className="demarrage-nom">Calbasse</div>
        </div>
        {children}
      </body>
    </html>
  );
}

/** Évite le flash blanc avant que l'app ne peigne son propre fond. */
const fond = `body { background-color: #FBF8F3; }`;

/**
 * Habillage de l'écran de démarrage.
 *
 * Tout est en CSS : l'animation tourne pendant que le code de l'application se télécharge et
 * s'exécute, sans rien lui disputer. La calebasse respire et son anneau tourne lentement — assez
 * pour que l'attente paraisse habitée, pas assez pour attirer l'œil.
 *
 * Les polices de l'app ne sont pas encore chargées à cet instant : le nom est écrit dans la
 * police du système, sinon il changerait de dessin sous les yeux au moment du fondu.
 */
const demarrageStyles = `
#demarrage {
  position: fixed; inset: 0; z-index: 9999;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 28px;
  background: #FBF8F3;
}
#demarrage .demarrage-art { position: relative; display: grid; place-items: center; width: 220px; height: 220px; }
#demarrage .demarrage-anneau {
  position: absolute; inset: 0; border-radius: 50%;
  border: 2px dashed #E1CFB6;
  animation: demarrage-tourne 8s linear infinite;
}
#demarrage svg { position: relative; animation: demarrage-respire 2.2s ease-in-out infinite; }
#demarrage .demarrage-nom {
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  font-weight: 800; font-size: 15px; letter-spacing: 4px; text-transform: uppercase;
  color: #9C4A1E;
  animation: demarrage-pulse 2.2s ease-in-out infinite;
}
@keyframes demarrage-tourne { to { transform: rotate(360deg); } }
@keyframes demarrage-respire { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
@keyframes demarrage-pulse { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }

/* Un mouvement permanent peut gêner ou rendre malade : on le coupe si le système le demande. */
@media (prefers-reduced-motion: reduce) {
  #demarrage .demarrage-anneau, #demarrage svg, #demarrage .demarrage-nom { animation: none; }
}
`;

/**
 * Enregistré après le chargement pour ne pas retarder le premier affichage. L'échec est ignoré :
 * un service worker refusé (navigateur ancien, page non sécurisée) ne doit pas empêcher d'utiliser
 * l'app, il la rend seulement non installable.
 */
const enregistrementServiceWorker = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}`;
