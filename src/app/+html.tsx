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

        <style dangerouslySetInnerHTML={{ __html: fond }} />
        <script dangerouslySetInnerHTML={{ __html: enregistrementServiceWorker }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

/** Évite le flash blanc avant que l'app ne peigne son propre fond. */
const fond = `body { background-color: #FBF8F3; }`;

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
