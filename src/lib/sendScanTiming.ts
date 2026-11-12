import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';

import { networkLabel, type ScanTiming } from './scanTiming';
import { supabase } from './supabase';

/**
 * Dépose une mesure de temps de saisie. Ne lève jamais d'erreur et ne s'attend pas.
 *
 * Pas de file hors ligne : une mesure perdue ne coûte rien, alors qu'une file de plus à vider
 * serait une source de pannes pour un chiffre de pilotage. Conséquence à garder en tête en
 * lisant les résultats : les enregistrements faits sans réseau n'y figurent pas, donc les pires
 * connexions sont un peu sous-représentées.
 */
export async function sendScanTiming(timing: ScanTiming, items: number): Promise<void> {
  try {
    const state = await NetInfo.fetch();
    const generation = state.type === 'cellular' ? state.details.cellularGeneration : null;
    // Le navigateur n'annonce qu'une classe de débit, et pas partout : Chrome oui, Safari non.
    const effectiveType =
      Platform.OS === 'web' ? ((globalThis.navigator as { connection?: { effectiveType?: string } } | undefined)?.connection?.effectiveType ?? null) : null;
    const platform = Platform.OS === 'web' || Platform.OS === 'android' || Platform.OS === 'ios' ? Platform.OS : null;
    if (!platform) return;
    await supabase.from('scan_timings').insert({
      ...timing,
      items: Math.min(50, items),
      platform,
      network: networkLabel(state.type, generation, effectiveType),
    });
  } catch {
    // Volontairement muet : voir le commentaire de la fonction.
  }
}
