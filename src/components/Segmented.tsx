import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radius, shadow } from '@/theme';

type Option<T extends string | number> = { value: T; label: string };

/** Choix exclusif en pilule (7 / 30 jours, repères locaux / grammes) : l'option active est blanche. */
export function Segmented<T extends string | number>({ options, value, onChange }: { options: Option<T>[]; value: T; onChange: (value: T) => void }) {
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.item, active && styles.active]}>
            <AppText style={[styles.text, active && styles.textActive]}>{o.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, padding: 4 },
  item: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  active: { backgroundColor: colors.surface, ...shadow.card },
  text: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  textActive: { fontWeight: '700', color: colors.text },
});
