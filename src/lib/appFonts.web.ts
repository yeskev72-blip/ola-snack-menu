import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';

import { fontFamilies } from '@/theme';

/**
 * Chargement de la police sur le web.
 *
 * Le plugin expo-font grave la police dans l'APK au moment de la construction native ; le web
 * n'a pas d'étape équivalente, donc sans ce chargement le navigateur ne connaît pas
 * « PlusJakartaSans_700Bold » et retombe sur sa police par défaut — un rendu visiblement
 * différent de l'app Android, sur chaque écran.
 *
 * Les clés doivent être exactement celles de fontFamilies : c'est le nom que fontFamily()
 * renvoie dans les styles.
 */
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    [fontFamilies['400']]: PlusJakartaSans_400Regular,
    [fontFamilies['500']]: PlusJakartaSans_500Medium,
    [fontFamilies['600']]: PlusJakartaSans_600SemiBold,
    [fontFamilies['700']]: PlusJakartaSans_700Bold,
    [fontFamilies['800']]: PlusJakartaSans_800ExtraBold,
  });
  // Police injoignable : on affiche l'app avec la police système plutôt que de bloquer sur un
  // écran vide. Mieux vaut un rendu dégradé qu'une app qui ne s'ouvre pas.
  return loaded || error !== null;
}
