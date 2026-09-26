import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';

type Shape =
  | { d: string }
  | { circle: [cx: number, cy: number, r: number] }
  | { rect: [x: number, y: number, w: number, h: number, rx: number] };

/** Icônes au trait arrondi de la maquette Calbasse (grille 24 × 24). */
const ICONS = {
  plus: [{ d: 'M12 5v14M5 12h14' }],
  minus: [{ d: 'M5 12h14' }],
  back: [{ d: 'm15 18-6-6 6-6' }],
  chevron: [{ d: 'm9 18 6-6-6-6' }],
  close: [{ d: 'M6 6l12 12M18 6 6 18' }],
  check: [{ d: 'm5 12 5 5 9-10' }],
  camera: [{ d: 'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z' }, { circle: [12, 13.5, 3.5] }],
  image: [{ rect: [3, 4, 18, 16, 3] }, { circle: [9, 10, 2] }, { d: 'm21 16-5-5-9 9' }],
  pencil: [{ d: 'M4 20h4L19 9l-4-4L4 16z' }],
  search: [{ circle: [11, 11, 7] }, { d: 'm20 20-4-4' }],
  journal: [{ rect: [4, 3, 16, 18, 3] }, { d: 'M8 8h8M8 12h8M8 16h5' }],
  chart: [{ d: 'M5 20V11M12 20V5M19 20v-6' }],
  user: [{ circle: [12, 8, 4] }, { d: 'M4 21a8 8 0 0 1 16 0' }],
  refresh: [{ d: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7' }],
  offline: [{ d: 'M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5.2-2.8M19 12.9a10 10 0 0 0-2.3-1.6M2 8.8a15 15 0 0 1 4.2-2.7M22 8.8A15 15 0 0 0 10.7 5M12 20h.01' }],
  protein: [{ d: 'M12 3c3.5 0 6 5.5 6 10a6 6 0 0 1-12 0c0-4.5 2.5-10 6-10z' }],
  carbs: [{ d: 'M12 21V9M12 13c-2.5 0-4-1.5-4-4 2.5 0 4 1.5 4 4zM12 13c2.5 0 4-1.5 4-4-2.5 0-4 1.5-4 4zM12 8c-1.5-1-1.5-3.5 0-5 1.5 1.5 1.5 4 0 5z' }],
  fat: [{ d: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z' }],
  flame: [{ d: 'M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 1 1.5 2 2 3 1.5.5-2-.5-4.5 0-6.5z' }],
  warning: [{ d: 'M12 3 2 20h20z' }, { d: 'M12 10v4M12 17h.01' }],
  info: [{ circle: [12, 12, 9] }, { d: 'M12 11v5M12 8h.01' }],
  alert: [{ circle: [12, 12, 9] }, { d: 'M12 8v5M12 16h.01' }],
  arrowDown: [{ d: 'M12 5v14M6 13l6 6 6-6' }],
  arrowUp: [{ d: 'M12 19V5M6 11l6-6 6 6' }],
  equal: [{ d: 'M5 9h14M5 15h14' }],
  arrowRight: [{ d: 'M5 12h14M13 6l6 6-6 6' }],
  clock: [{ circle: [12, 12, 9] }, { d: 'M12 7v5l3 2' }],
  bolt: [{ d: 'M13 2 4 14h7l-1 8 9-12h-7z' }],
  phone: [{ rect: [6, 2, 12, 20, 3] }, { d: 'M11 18h2' }],
  star: [{ d: 'm12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z' }],
  trash: [{ d: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13' }],
  logout: [{ d: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10' }],
  mail: [{ rect: [3, 5, 18, 14, 3] }, { d: 'm3 7 9 6 9-6' }],
  lock: [{ rect: [4, 11, 16, 10, 3] }, { d: 'M8 11V8a4 4 0 0 1 8 0v3' }],
} satisfies Record<string, Shape[]>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 22, color = colors.text, strokeWidth = 2 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {(ICONS[name] as Shape[]).map((s, i) =>
        'd' in s ? <Path key={i} d={s.d} /> : 'circle' in s ? <Circle key={i} cx={s.circle[0]} cy={s.circle[1]} r={s.circle[2]} /> : <Rect key={i} x={s.rect[0]} y={s.rect[1]} width={s.rect[2]} height={s.rect[3]} rx={s.rect[4]} />,
      )}
    </Svg>
  );
}
