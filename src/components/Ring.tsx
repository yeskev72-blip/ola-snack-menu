import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/theme';

type Props = {
  /** Part remplie, de 0 à 1 (bornée). */
  progress: number;
  size: number;
  stroke: number;
  color: string;
  track?: string;
  /** Contenu centré (icône, chiffre). */
  children?: ReactNode;
};

/** Anneau de progression (calories, macros), rempli dans le sens horaire depuis midi. */
export function Ring({ progress, size, stroke, color, track = colors.surfaceAlt, children }: Props) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const ratio = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 1) : 0;
  const c = size / 2;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {ratio > 0 ? (
          <Circle
            cx={c}
            cy={c}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - ratio)}
            transform={`rotate(-90 ${c} ${c})`}
          />
        ) : null}
      </Svg>
      {children ? <View style={styles.center}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
