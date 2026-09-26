import { router } from 'expo-router';

import { AppText } from '@/components/AppText';
import { FoodList } from '@/components/FoodList';
import { Screen } from '@/components/Screen';
import { t } from '@/i18n';
import { defaultGrams, type LocalFood } from '@/lib/foods';
import { useScanDraft } from '@/state/scanDraft';
import { spacing } from '@/theme';

/** Onglet Aliments : la table des plats ; un plat touché démarre un repas saisi à la main. */
export default function Foods() {
  const draft = useScanDraft();

  const choose = (food: LocalFood) => {
    draft.reset();
    const key = draft.addItem({ food_key: food.food_key, label: food.label_fr, grams: defaultGrams(food), confidence: null, estimate_100g: null });
    router.push('/result');
    router.push({ pathname: '/item-editor', params: { key } });
  };

  return (
    <Screen title={t('picker.foodsTitle')} scroll={false} edges={['top']}>
      <AppText variant="muted" style={{ marginTop: -spacing.sm }}>
        {t('picker.foodsIntro')}
      </AppText>
      <FoodList onChoose={choose} />
    </Screen>
  );
}
