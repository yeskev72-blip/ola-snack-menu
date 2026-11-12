/**
 * Système de design Calbasse. Les couleurs viennent des fondations visuelles livrées le
 * 11 novembre (voir design/project/Fondations.dc.html).
 *
 * Terre cuite pour l'action, encre pour les surfaces sombres et les états actifs, feuille pour
 * ce qui est vérifié. Fond sable chaud plutôt que blanc : l'écran doit rester lisible en plein
 * soleil. Contraste AA minimum, cibles tactiles de 48 dp au moins.
 */
export const colors = {
  /** Fond de l'app : sable chaud, pas blanc. */
  background: '#FBF5EA',
  surface: '#FFFFFF',
  /** Sable : surfaces posées sur le fond, segments au repos. */
  surfaceAlt: '#F3E6CB',
  border: '#E8DAC0',
  /** Encre. */
  text: '#2B1810',
  textMuted: '#6B5444',
  /** Encre également : surfaces sombres, puces actives, sélection d'un segment. */
  primary: '#2B1810',
  primaryPressed: '#4A2E22',
  onPrimary: '#FFFFFF',
  /** Terre cuite : la couleur de l'action. */
  accent: '#B04A1C',
  /** Terre foncée : texte d'accent, et appui sur un bouton terre cuite. */
  accentStrong: '#7A3416',
  /** Terre douce : fond d'une sélection. */
  accentSoft: '#F8E3D4',
  highlight: '#C98A0B',
  /** Feuille : ce qui est vérifié, ce qui est atteint. */
  success: '#2E6B3E',
  successSoft: '#E2F0E2',
  danger: '#B42318',
  protein: '#D64545',
  carbs: '#E8A317',
  fat: '#2F6FDB',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  /** Cartes. */
  card: 20,
  lg: 24,
  pill: 999,
} as const;

/** Tailles de texte (px). */
export const font = {
  small: 13,
  body: 16,
  large: 18,
  title: 24,
  display: 44,
} as const;

/** Hauteurs de ligne associées. */
export const lineHeight = {
  small: 18,
  body: 24,
  large: 26,
  title: 30,
  display: 48,
} as const;

/**
 * Plus Jakarta Sans, embarquée dans l'APK (plugin expo-font) : une famille par graisse sur Android.
 * AppText choisit la famille selon fontWeight ; sans la police (Expo Go), la police système prend le relais.
 */
export const fontFamilies = {
  '400': 'PlusJakartaSans_400Regular',
  '500': 'PlusJakartaSans_500Medium',
  '600': 'PlusJakartaSans_600SemiBold',
  '700': 'PlusJakartaSans_700Bold',
  '800': 'PlusJakartaSans_800ExtraBold',
} as const;

export type FontWeight = keyof typeof fontFamilies;

export function fontFamily(weight: string | number | undefined): string {
  const w = String(weight ?? '400');
  if (w === 'bold') return fontFamilies['700'];
  if (w in fontFamilies) return fontFamilies[w as FontWeight];
  const n = Number(w);
  if (!Number.isFinite(n) || n <= 400) return fontFamilies['400'];
  return n >= 800 ? fontFamilies['800'] : n >= 700 ? fontFamilies['700'] : n >= 600 ? fontFamilies['600'] : fontFamilies['500'];
}

/** Ombre des cartes : pas de bordure visible, jamais de carte sur une carte. */
export const shadow = {
  card: {
    shadowColor: '#3C230F',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
} as const;

/** Hauteur des boutons principaux. */
export const touchTarget = 56;
