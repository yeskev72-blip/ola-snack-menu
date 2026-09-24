/**
 * Thème inspiré de la calebasse : tons chauds et terreux, contraste élevé
 * pour rester lisible en plein soleil, cibles tactiles larges.
 */
export const colors = {
  background: '#FBF6EE',
  surface: '#FFFFFF',
  surfaceAlt: '#F3E9DA',
  border: '#E2D2BC',
  text: '#2B1B10',
  textMuted: '#5E4A3A',
  primary: '#9C4A1E',
  primaryPressed: '#7A3914',
  onPrimary: '#FFFFFF',
  accent: '#C98A0B',
  success: '#2F6B2A',
  danger: '#B3261E',
  protein: '#8E3B2F',
  carbs: '#B07A07',
  fat: '#4F7334',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export const font = {
  small: 14,
  body: 17,
  large: 20,
  title: 26,
  display: 40,
} as const;

/** Hauteur minimale des boutons (au-dessus des 48 dp recommandés). */
export const touchTarget = 56;
