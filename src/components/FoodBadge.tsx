import { Badge } from '@/components/Badge';
import { t } from '@/i18n';
import { isUnverified } from '@/lib/foodStatus';

/**
 * Pastille de provenance d'un aliment.
 *
 * Jusqu'ici seules les estimations étaient signalées, et le silence sur les autres ne disait
 * rien : on ne savait pas si une valeur était vérifiée ou simplement non annotée. Les deux cas
 * se voient maintenant.
 *
 * Le libellé reste « Vérifié » et ne cite aucune table de composition : les lignes vérifiées
 * de supabase/seed/foods.json portent une estimation interne, explicitement non confrontée à la
 * table FAO/INFOODS. Afficher cette source serait faux.
 */
export function FoodBadge({ food }: { food: { verified: boolean } | undefined | null }) {
  if (!food) return null;
  return isUnverified(food)
    ? <Badge label={t('result.unverified')} tone="estimated" />
    : <Badge label={t('result.verified')} tone="verified" />;
}
