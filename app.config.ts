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
  platforms: ['android'],
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
    permissions: ['android.permission.CAMERA'],
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.VIBRATE',
    ],
    predictiveBackGestureEnabled: false,
  },
  plugins: [
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
  extra: EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {},
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
