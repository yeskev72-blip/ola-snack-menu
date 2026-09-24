import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { AppText } from '@/components/AppText';
import { t } from '@/i18n';
import { niceTicks, parseDayKey, type DayTotals } from '@/lib/days';
import { colors, font } from '@/theme';

type Props = {
  days: DayTotals[];
  target: number | null;
  selected: string | null;
  onSelect: (day: string) => void;
};

const HEIGHT = 200;
const AXIS_WIDTH = 44;
const X_LABEL_HEIGHT = 22;
const TOP_PAD = 18;
const GAP = 2;
const MAX_BAR = 24;

const WEEKDAY = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
/** Colonnes non sélectionnées : teinte pleine atténuée (pas de transparence qui laisserait voir la grille). */
const MUTED_BAR = '#D9BBA8';

/** Colonne avec extrémité arrondie (4 px) et base carrée, posée sur la ligne de base. */
function columnPath(x: number, y: number, width: number, height: number): string {
  const r = Math.min(4, width / 2, height);
  return `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
}

const formatKcal = (v: number) => v.toLocaleString('fr-FR');

/**
 * Calories par jour : une seule série (pas de légende, le titre la nomme),
 * ligne de référence pour la cible, sélection d'un jour au toucher.
 */
export function DailyChart({ days, target, selected, onSelect }: Props) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const max = Math.max(target ?? 0, ...days.map((d) => d.kcal), 1);
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1]!;
  const plotWidth = Math.max(width - AXIS_WIDTH, 0);
  const plotHeight = HEIGHT - TOP_PAD - X_LABEL_HEIGHT;
  const slot = days.length ? plotWidth / days.length : 0;
  const barWidth = Math.max(Math.min(MAX_BAR, slot - GAP), 2);
  const y = (v: number) => TOP_PAD + plotHeight * (1 - v / top);
  const labelEvery = days.length > 10 ? 7 : 1;

  return (
    <View onLayout={onLayout} accessible accessibilityLabel={t('history.chartLabel', { days: days.length })}>
      {target ? (
        <View style={styles.key}>
          <View style={styles.keyLine} />
          <AppText variant="small" style={styles.keyText}>
            {t('history.targetLine', { kcal: formatKcal(target) })}
          </AppText>
        </View>
      ) : null}
      {width > 0 ? (
        <Svg width={width} height={HEIGHT}>
          {/* Grille horizontale recessive et graduations rondes */}
          {ticks.map((tick) => (
            <G key={tick}>
              <Line x1={AXIS_WIDTH} x2={width} y1={y(tick)} y2={y(tick)} stroke={colors.border} strokeWidth={1} />
              <SvgText x={AXIS_WIDTH - 6} y={y(tick) + 4} fontSize={11} fill={colors.textMuted} textAnchor="end">
                {formatKcal(tick)}
              </SvgText>
            </G>
          ))}

          {days.map((d, i) => {
            const x = AXIS_WIDTH + i * slot + (slot - barWidth) / 2;
            const h = plotHeight * (d.kcal / top);
            const isSelected = d.day === selected;
            const date = parseDayKey(d.day);
            const isLast = i === days.length - 1;
            const showLabel = days.length <= 10 || (days.length - 1 - i) % labelEvery === 0;
            return (
              <G key={d.day}>
                {d.kcal > 0 ? (
                  <Path d={columnPath(x, y(d.kcal), barWidth, h)} fill={selected && !isSelected ? MUTED_BAR : colors.primary} />
                ) : null}
                {showLabel ? (
                  <SvgText
                    x={isLast && slot < 24 ? width : AXIS_WIDTH + i * slot + slot / 2}
                    y={HEIGHT - 6}
                    fontSize={11}
                    fill={isSelected ? colors.text : colors.textMuted}
                    fontWeight={isSelected ? '700' : '400'}
                    textAnchor={isLast && slot < 24 ? 'end' : 'middle'}>
                    {days.length <= 10 ? WEEKDAY[date.getDay()] : String(date.getDate())}
                  </SvgText>
                ) : null}
                {/* Zone tactile de toute la hauteur, plus large que la colonne */}
                <Rect x={AXIS_WIDTH + i * slot} y={0} width={slot} height={HEIGHT} fill="transparent" onPress={() => onSelect(d.day)} />
              </G>
            );
          })}

          {/* Ligne de référence de la cible (étiquetée dans la clé au-dessus du graphique) */}
          {target ? <Line x1={AXIS_WIDTH} x2={width} y1={y(target)} y2={y(target)} stroke={colors.text} strokeWidth={1} /> : null}
        </Svg>
      ) : (
        <View style={{ height: HEIGHT }} />
      )}
      <AppText variant="small" style={styles.caption}>
        {selected
          ? t('history.selected', {
              day: parseDayKey(selected).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }),
              kcal: formatKcal(days.find((d) => d.day === selected)?.kcal ?? 0),
            })
          : t('history.tapHint')}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  key: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6, marginBottom: 2 },
  keyLine: { width: 16, height: 2, backgroundColor: colors.text },
  keyText: { color: colors.text },
  caption: { textAlign: 'center', fontSize: font.small, marginTop: 4 },
});
