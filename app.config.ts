import type { ExpoConfig } from 'expo/config';

import brand from './src/brand.json';

/** Identifiant Android définitif : ne plus le changer une fois l'app publiée. */
const ANDROID_PACKAGE = 'com.calbasse.app';

/** Rempli après `eas init` (identifiant du projet sur expo.dev). */
const EAS_PROJECT_ID = 'ac897088-9f91-4f54-9932-d2a7ff409e4a';

/** Compte expo.dev propriétaire du projet (builds EAS). */
const EAS_OWNER = 'dessoyess-team';

const config: ExpoConfig = {
  name: brand.appName,
  owner: EAS_OWNER,
  slug: 'calbasse',
  scheme: 'calbasse',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'light',
  // Le web sert de vitrine d'essai : on scanne un repas sans rien installer, puis « Ajouter à
  // l'écran d'accueil » transforme le site en application autonome. L'APK reste la version
  // complète — les rappels quotidiens n'existent pas sur le web.
  platforms: ['android', 'web'],
  web: { output: 'static', favicon: './assets/images/icon.png' },
  android: {
    package: ANDROID_PACKAGE,
    adaptiveIcon: {
      backgroundColor: '#FBF6EE',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    // Seule la caméra est demandée ; la galerie passe par le sélecteur système
    // (stockage seulement sur Android 12 et moins). Les permissions inutiles ajoutées
    // par le modèle Expo sont retirées du manifeste.
    permissions: [
      'android.permission.CAMERA',
      // Déclarées explicitement plutôt que laissées au plugin : sans POST_NOTIFICATIONS
      // (Android 13+) aucun rappel n'arrive, et sans VIBRATE le rappel passe inaperçu.
      'android.permission.POST_NOTIFICATIONS',
      'android.permission.VIBRATE',
    ],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    [
      'expo-font',
      {
        // Plus Jakarta Sans embarquée dans l'APK : une famille par graisse (voir fontFamilies dans src/theme.ts).
        fonts: ['400Regular', '500Medium', '600SemiBold', '700Bold', '800ExtraBold'].map(
          (w) => `node_modules/@expo-google-fonts/plus-jakarta-sans/${w}/PlusJakartaSans_${w}.ttf`,
        ),
      },
    ],
    // Rappels quotidiens, programmés localement : aucune notification distante, donc pas de
    // compte Firebase ni de jeton d'appareil. Ajoute POST_NOTIFICATIONS, requis depuis Android 13.
    'expo-notifications',
    'expo-router',
    [
      'expo-image-picker',
      {
        cameraPermission: `${brand.appName} utilise l'appareil photo pour photographier tes repas.`,
        microphonePermission: false,
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#FBF6EE',
        image: './assets/images/splash-icon.png',
        imageWidth: 160,
      },
    ],
    [
      'expo-build-properties',
      {
        android: {
          // Téléphones réels uniquement (x86 / x86_64 ne servent qu'aux émulateurs).
          // armeabi-v7a garde les téléphones d'entrée de gamme 32 bits.
          buildArchs: ['arm64-v8a', 'armeabi-v7a'],
          // Bibliothèques natives compressées dans l'APK : téléchargement bien plus léger.
          useLegacyPackaging: true,
          // R8 : retire le code Java inutilisé et les ressources non référencées.
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
      },
    ],
  ],
  /**
   * Mises à jour à distance (EAS Update) : une correction du code JavaScript part par
   * `eas update` et s'installe au lancement suivant, sans nouvel APK. Un changement natif
   * (module, permission) demande toujours un nouveau build : l'empreinte change et les
   * anciens APK cessent alors de recevoir ces mises à jour, au lieu de planter.
   */
  updates: {
    url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
    // Le démarrage n'attend jamais le réseau : la version déjà installée s'ouvre tout de suite
    // et la mise à jour téléchargée en fond s'applique au lancement d'après.
    fallbackToCacheTimeout: 0,
  },
  runtimeVersion: { policy: 'fingerprint' },
  extra: EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {},
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
