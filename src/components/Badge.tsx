import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { radius, spacing } from '@/theme';

/** Pastille courte accolée au nom d'un aliment : « estimé », « à confirmer ». */
export function Badge({ label }: { label: string }) {
  return (
    <View style={styles.box}>
      <AppText style={styles.text}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: '#FBEBC4' },
  text: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: '#7A5200' },
});
