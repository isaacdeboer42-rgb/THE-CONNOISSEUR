import { describe, expect, it } from 'vitest';

import type { CatalogueRecipe } from '@/catalogue/types';
import { auditCatalogueRecipe, isCatalogueRecipeVisible } from '@/catalogue/validation';

function recipe(overrides: Partial<CatalogueRecipe> = {}): CatalogueRecipe {
  return {
    id: 1,
    name: 'Audited Sour',
    instructions: 'Shake with ice and strain.',
    source: 'Test editorial source',
    sourceUrl: 'https://example.test/audited-sour',
    ingredients: [
      {
        ingredientId: 10,
        ingredientName: 'Bourbon',
        amount: 60,
        unitName: 'Millilitre',
        unitAbbreviation: 'ml',
      },
    ],
    tags: [],
    ...overrides,
  };
}

describe('broad catalogue recipe audit', () => {
  it('allows structurally complete records into reference Make mode without claiming editorial approval', () => {
    const result = auditCatalogueRecipe(recipe());

    expect(result.makeReady).toBe(true);
    expect(result.status).toBe('structurally-complete');
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'editorial-verification-required',
      severity: 'warning',
    }));
  });

  it('blocks Make mode when instructions, quantities, or units are missing', () => {
    const result = auditCatalogueRecipe(recipe({
      instructions: undefined,
      ingredients: [{ ingredientId: 10, ingredientName: 'Bourbon' }],
    }));

    expect(result.makeReady).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'missing-instructions',
      'missing-amount',
      'missing-unit',
    ]));
    expect(isCatalogueRecipeVisible(recipe({
      instructions: undefined,
      ingredients: [{ ingredientId: 10, ingredientName: 'Bourbon' }],
    }))).toBe(false);
  });

  it.each([
    ['top', 'to top'],
    ['rinse', 'to rinse'],
  ])('accepts the qualitative %s measure without inventing a numeric amount', (unitAbbreviation, unitName) => {
    const result = auditCatalogueRecipe(recipe({
      ingredients: [{
        ingredientId: 10,
        ingredientName: 'Soda Water',
        unitAbbreviation,
        unitName,
      }],
    }));

    expect(result.makeReady).toBe(true);
    expect(isCatalogueRecipeVisible(recipe({
      ingredients: [{
        ingredientId: 10,
        ingredientName: 'Soda Water',
        unitAbbreviation,
        unitName,
      }],
    }))).toBe(true);
    expect(result.issues).not.toContainEqual(expect.objectContaining({ code: 'missing-amount' }));
  });

  it('flags duplicate ingredient rows and missing provenance for human review', () => {
    const ingredient = recipe().ingredients[0];
    const result = auditCatalogueRecipe(recipe({
      source: undefined,
      sourceUrl: undefined,
      ingredients: [ingredient, { ...ingredient }],
    }));

    expect(result.makeReady).toBe(true);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'missing-source', severity: 'warning' }),
      expect.objectContaining({ code: 'duplicate-ingredient', severity: 'warning' }),
    ]));
  });
});
