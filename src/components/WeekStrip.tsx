import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { dayKey, parseDayKey } from '@/lib/days';
import { colors, radius } from '@/theme';

const WEEKDAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

/** Les 7 jours de la semaine en cours (lundi → dimanche) pour une journée donnée. */
export function weekOf(today: string): string[] {
  const d = parseDayKey(today);
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => dayKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)));
}

type Props = {
  today: string;
  selected: string;
  /** Jours de la semaine où au moins un repas est enregistré. */
  filled: ReadonlySet<string>;
  onSelect: (day: string) => void;
};

/** Sélecteur de jours : jour choisi en noir, anneau brun si des repas sont saisis, pointillés sinon. */
export function WeekStrip({ today, selected, filled, onSelect }: Props) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {weekOf(today).map((day) => {
        const date = parseDayKey(day);
        const future = day > today;
        const active = day === selected;
        return (
          <Pressable
            key={day}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled: future }}
            accessibilityLabel={date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            disabled={future}
            onPress={() => onSelect(day)}
            style={[styles.day, active && styles.dayActive, future && styles.future]}>
            <AppText style={[styles.weekday, active && styles.onDark]}>{WEEKDAYS[date.getDay()]}</AppText>
            <View style={[styles.date, active ? styles.dateActive : future ? null : filled.has(day) ? styles.dateFilled : styles.dateEmpty]}>
              <AppText style={[styles.num, active && styles.numActive]}>{date.getDate()}</AppText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 2 },
  day: { flex: 1, height: 64, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 4 },
  dayActive: { backgroundColor: colors.primary },
  future: { opacity: 0.4 },
  weekday: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: colors.textMuted },
  onDark: { color: colors.onPrimary },
  date: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dateActive: { backgroundColor: colors.surface },
  dateFilled: { borderWidth: 2, borderColor: colors.accent },
  dateEmpty: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#CDBBA3' },
  num: { fontSize: 14, lineHeight: 18, fontWeight: '700' },
  numActive: { fontWeight: '800' },
});
