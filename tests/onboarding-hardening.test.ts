import { describe, expect, it } from 'vitest';

import {
  iceChoicesConfirmed,
  SAMPLE_INGREDIENT_IDS,
  STARTER_INGREDIENT_IDS,
} from '@/domain/onboarding';

describe('onboarding research fixtures', () => {
  it('keeps the sample bar aligned with the bourbon starter and leaves lemon missing', () => {
    expect(SAMPLE_INGREDIENT_IDS).toEqual(STARTER_INGREDIENT_IDS);
    expect(SAMPLE_INGREDIENT_IDS).toEqual(['bourbon', 'simple-syrup', 'egg-white']);
    expect(SAMPLE_INGREDIENT_IDS).not.toContain('lemon-juice');
  });

  it('requires an explicit answer for both independent ice formats', () => {
    expect(iceChoicesConfirmed({ 'standard-ice': 'unknown', 'large-ice': 'available' })).toBe(false);
    expect(iceChoicesConfirmed({ 'standard-ice': 'unavailable', 'large-ice': 'unknown' })).toBe(false);
    expect(iceChoicesConfirmed({ 'standard-ice': 'available', 'large-ice': 'unavailable' })).toBe(true);
  });
});
