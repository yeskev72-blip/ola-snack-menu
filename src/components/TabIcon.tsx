import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type TabIconName = 'journal' | 'scan' | 'history' | 'profile';

/** Icônes de navigation dessinées à la main pour éviter une police d'icônes complète. */
export function TabIcon({ name, color, size = 26 }: { name: TabIconName; color: ColorValue; size?: number }) {
  const stroke = { stroke: color, strokeWidth: 2.2, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'journal' && (
        <>
          <Path d="M3 12a9 9 0 0 0 18 0Z" {...stroke} />
          <Path d="M8 8c0-1.5 1-2 1-3.5M12 8c0-1.5 1-2 1-3.5" {...stroke} />
        </>
      )}
      {name === 'scan' && (
        <>
          <Rect x={3} y={6} width={18} height={14} rx={3} {...stroke} />
          <Path d="M9 6l1.5-2h3L15 6" {...stroke} />
          <Circle cx={12} cy={13} r={3.5} {...stroke} />
        </>
      )}
      {name === 'history' && <Path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6" {...stroke} />}
      {name === 'profile' && (
        <>
          <Circle cx={12} cy={8} r={4} {...stroke} />
          <Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" {...stroke} />
        </>
      )}
    </Svg>
  );
}
