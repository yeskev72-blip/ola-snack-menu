/**
 * Système de design Calbasse (refonte) : interface claire et épurée, gros chiffres, cartes blanches très
 * arrondies avec ombre douce, boutons pilule noirs. L'accent brun calebasse est réservé au scanner, à
 * l'anneau des calories et aux états actifs. Contraste AA minimum, cibles tactiles de 48 dp au moins.
 */
export const colors = {
  background: '#FBF8F3',
  surface: '#FFFFFF',
  surfaceAlt: '#F3ECE1',
  border: '#E6DCCD',
  text: '#1B1511',
  textMuted: '#685A4D',
  primary: '#1B1511',
  primaryPressed: '#3B2E24',
  onPrimary: '#FFFFFF',
  accent: '#9C4A1E',
  accentSoft: '#F6E6D3',
  highlight: '#C98A0B',
  success: '#1E7A4C',
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
