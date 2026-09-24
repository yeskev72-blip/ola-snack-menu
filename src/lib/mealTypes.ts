import type { MessageKey } from '@/i18n';
import type { TypeRepas } from '@/lib/database.types';

/** Types de repas dans l'ordre de la journée, avec leur libellé. */
export const MEAL_TYPES: { value: TypeRepas; label: MessageKey }[] = [
  { value: 'petit_dejeuner', label: 'meals.breakfast' },
  { value: 'dejeuner', label: 'meals.lunch' },
  { value: 'en_cas', label: 'meals.snack' },
  { value: 'diner', label: 'meals.dinner' },
];

export const mealTypeLabel = (type: TypeRepas): MessageKey =>
  MEAL_TYPES.find((m) => m.value === type)?.label ?? 'meals.snack';
