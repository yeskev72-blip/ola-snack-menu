import { router, useLocalSearchParams } from 'expo-router';

import { FoodList } from '@/components/FoodList';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { defaultGrams, type LocalFood } from '@/lib/foods';
import { useScanDraft } from '@/state/scanDraft';

export default function FoodPicker() {
  /** replace = clé de l'élément dont on change l'aliment ; sinon on ajoute un élément. */
  const { replace } = useLocalSearchParams<{ replace?: string }>();
  const draft = useScanDraft();

  const choose = (food: LocalFood) => {
    if (replace) {
      draft.updateItem(replace, { food_key: food.food_key, label: food.label_fr, estimate_100g: null });
      router.back();
      return;
    }
    const key = draft.addItem({ food_key: food.food_key, label: food.label_fr, grams: defaultGrams(food), confidence: null, estimate_100g: null });
    router.replace({ pathname: '/item-editor', params: { key } });
  };

  return (
    <Screen title={t('picker.addTitle')} back="back" scroll={false} edges={['top', 'bottom']}>
      <FoodList onChoose={choose} autoFocus />
    </Screen>
  );
}
