import type { ExpoConfig } from 'expo/config';

import brand from './src/brand.json';

/** Identifiant Android définitif : ne plus le changer une fois l'app publiée. */
const ANDROID_PACKAGE = 'com.calebasse.app';

/** Rempli après `eas init` (identifiant du projet sur expo.dev). */
const EAS_PROJECT_ID = '';

const config: ExpoConfig = {
  name: brand.appName,
  slug: 'calebasse',
  scheme: 'calebasse',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'light',
  platforms: ['android'],
  android: {
    package: ANDROID_PACKAGE,
    versionCode: 1,
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
  ],
  extra: EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {},
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

export default config;
