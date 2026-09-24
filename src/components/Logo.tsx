import Svg, { Circle, Ellipse } from 'react-native-svg';

/** Calebasse vue de dessus : rebord, intérieur, reflet. Même dessin que l'icône de l'app. */
export function Logo({ size = 96 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityRole="image">
      <Circle cx={50} cy={50} r={46} fill="#9C4A1E" />
      <Circle cx={50} cy={50} r={38} fill="#D9A55B" />
      <Circle cx={50} cy={50} r={31} fill="#F3D9A4" />
      <Ellipse cx={39} cy={38} rx={10} ry={6} fill="#FFF6E3" opacity={0.8} transform="rotate(-35 39 38)" />
    </Svg>
  );
}
