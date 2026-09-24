/**
 * Journées locales et agrégats pour l'historique. Module pur : testé avec `node --test`.
 */

export type DayTotals = { day: string; kcal: number; proteines: number; glucides: number; lipides: number; meals: number };

type MealLike = { eaten_at: string; total: { kcal: number; proteines: number; glucides: number; lipides: number } };

const pad = (n: number) => String(n).padStart(2, '0');

/** Clé « AAAA-MM-JJ » de la journée locale du téléphone. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Date (minuit local) d'une clé « AAAA-MM-JJ ». */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

/** Les n dernières journées, de la plus ancienne à aujourd'hui inclus. */
export function lastDays(n: number, today: Date): string[] {
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    keys.push(dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)));
  }
  return keys;
}

/** Totaux par journée, une entrée par clé demandée (0 si aucun repas). */
export function totalsByDay(meals: MealLike[], days: string[]): DayTotals[] {
  const byDay = new Map(days.map((day) => [day, { day, kcal: 0, proteines: 0, glucides: 0, lipides: 0, meals: 0 }]));
  for (const meal of meals) {
    const entry = byDay.get(dayKey(new Date(meal.eaten_at)));
    if (!entry) continue;
    entry.kcal += meal.total.kcal;
    entry.proteines += meal.total.proteines;
    entry.glucides += meal.total.glucides;
    entry.lipides += meal.total.lipides;
    entry.meals += 1;
  }
  return days.map((day) => {
    const e = byDay.get(day)!;
    return { ...e, kcal: Math.round(e.kcal), proteines: Math.round(e.proteines), glucides: Math.round(e.glucides), lipides: Math.round(e.lipides) };
  });
}

/** Moyenne sur les journées renseignées uniquement (une journée vide n'est pas un jeûne). */
export function averageKcal(days: DayTotals[]): number | null {
  const filled = days.filter((d) => d.meals > 0);
  return filled.length ? Math.round(filled.reduce((s, d) => s + d.kcal, 0) / filled.length) : null;
}

/** Graduations « rondes » de 0 au-dessus du maximum (500, 1000, 2000…). */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? 10 * magnitude;
  const ticks: number[] = [];
  for (let v = 0; v < max + step; v += step) ticks.push(Math.round(v));
  return ticks;
}
