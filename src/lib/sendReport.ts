import { isOnline } from '@/lib/analyze';
import { cleanReport } from '@/lib/foodReport';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';

/**
 * Envoi d'un signalement : « ce chiffre me paraît faux ».
 *
 * Le signalement part tout de suite ou pas du tout. Contrairement à un repas, il n'est pas mis
 * en file hors ligne : une file invisible ferait croire à l'utilisateur qu'on l'a entendu, et
 * c'est précisément la confiance qu'on cherche à gagner ici. Sans réseau, on le dit.
 */
export async function sendReport(input: {
  foodKey: string | null;
  label: string;
  mealId: string | null;
  message: string;
}): Promise<void> {
  if (!(await isOnline())) throw new Error(t('report.offline'));
  const { error } = await supabase.from('food_reports').insert({
    food_key: input.foodKey,
    label: input.label.slice(0, 120),
    meal_id: input.mealId,
    message: cleanReport(input.message),
  });
  if (error) throw error;
}
