import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { t } from '@/i18n';
import { formatNumber } from '@/lib/format';
import { colors } from '@/theme';

type Props = { eaten: number; target: number; size?: number };

/** Anneau des calories : se remplit avec ce qui est mangé, passe en rouge au-delà de la cible. */
export function CalorieRing({ eaten, target, size = 200 }: Props) {
  const stroke = 16;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = target > 0 ? Math.min(eaten / target, 1) : 0;
  const over = eaten > target;
  const remaining = formatNumber(Math.abs(target - eaten));

  return (
    <View style={{ width: size, height: size }} accessible accessibilityLabel={`${remaining} ${t('common.kcal')} ${over ? t('journal.over') : t('journal.remaining')}`}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={colors.surfaceAlt} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={over ? colors.danger : colors.primary}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - ratio)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.center}>
          <AppText variant="display" style={over ? styles.over : undefined}>
            {remaining}
          </AppText>
          <AppText variant="muted">
            {t('common.kcal')} {over ? t('journal.over') : t('journal.remaining')}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  over: { color: colors.danger },
});
