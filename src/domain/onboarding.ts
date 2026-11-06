import { BarSnapshot, IngredientId } from '@/domain/types';

export const STARTER_INGREDIENT_IDS = [
  'bourbon',
  'simple-syrup',
  'egg-white',
] as const satisfies readonly IngredientId[];

// The research sample intentionally mirrors the starter fixture. Lemon remains
// absent so the first recommendation demonstrates a genuine one-away result.
export const SAMPLE_INGREDIENT_IDS = STARTER_INGREDIENT_IDS;

export function iceChoicesConfirmed(basics: BarSnapshot['basics']): boolean {
  return basics['standard-ice'] !== 'unknown' && basics['large-ice'] !== 'unknown';
}
