import { describe, expect, it } from 'vitest';

import { recipeById, recipes } from '@/data/catalog';
import { formatRequirementAmount } from '@/domain/format';
import { getRecommendations, matchRecipe, resolveAvailableIngredients } from '@/domain/matching';
import { createEmptySnapshot } from '@/domain/persistence';
import { scoreTaste } from '@/domain/preferences';
import { BarSnapshot, IngredientId, InventoryItem } from '@/domain/types';

function inventory(ids: IngredientId[], status: InventoryItem['status'] = 'onHand'): InventoryItem[] {
  return ids.map((ingredientId, index) => ({
    id: `item-${index}-${ingredientId}`,
    ingredientId,
    status,
    source: 'generic',
    addedAt: '2026-01-01T00:00:00.000Z',
    revision: 1,
  }));
}

function referenceSnapshot(): BarSnapshot {
  return {
    ...createEmptySnapshot(),
    inventory: inventory(['bourbon', 'simple-syrup', 'egg-white']),
    basics: { 'standard-ice': 'available', 'large-ice': 'available' },
  };
}

describe('matching engine', () => {
  it('matches the bourbon reference scenario exactly', () => {
    const matches = getRecommendations(recipes, referenceSnapshot());
    const byId = Object.fromEntries(matches.map((match) => [match.recipe.id, match]));

    expect(byId['whiskey-sour'].category).toBe('oneAway');
    expect(byId['whiskey-sour'].missingRequired).toEqual(['lemon-juice']);
    expect(byId['old-fashioned'].category).toBe('oneAway');
    expect(byId['old-fashioned'].missingRequired).toEqual(['aromatic-bitters']);
    expect(byId['bourbon-smash'].category).toBe('moreToExplore');
    expect(byId['bourbon-smash'].missingRequired).toEqual(['lemon-juice', 'mint']);
  });

  it('promotes the Whiskey Sour after lemon juice is added', () => {
    const snapshot = referenceSnapshot();
    snapshot.inventory = [...snapshot.inventory, ...inventory(['lemon-juice'])];

    const match = matchRecipe(recipeById['whiskey-sour'], snapshot.inventory, snapshot.basics);
    expect(match.category).toBe('ready');
    expect(match.missingRequired).toEqual([]);
    expect(match.explanation).toContain('Everything you need');
  });

  it('never lets optional garnish block readiness', () => {
    const snapshot = referenceSnapshot();
    snapshot.inventory = [...snapshot.inventory, ...inventory(['lemon-juice'])];

    const match = matchRecipe(recipeById['whiskey-sour'], snapshot.inventory, snapshot.basics);
    expect(match.category).toBe('ready');
    expect(match.missingOptional).toContain('orange-peel');
    expect(match.missingRequired).not.toContain('orange-peel');
  });

  it('does not satisfy a requirement with an out-of-stock item', () => {
    const snapshot = referenceSnapshot();
    snapshot.inventory = [...snapshot.inventory, ...inventory(['lemon-juice'], 'outOfStock')];

    const match = matchRecipe(recipeById['whiskey-sour'], snapshot.inventory, snapshot.basics);
    expect(match.category).toBe('oneAway');
    expect(match.missingRequired).toEqual(['lemon-juice']);
  });

  it('always supplies water without a user-managed basic', () => {
    const resolved = resolveAvailableIngredients([], {
      'standard-ice': 'unknown',
      'large-ice': 'unknown',
    });
    expect(resolved.available.has('water')).toBe(true);
  });

  it('deduplicates multiple supplies of the same canonical ingredient', () => {
    const supplies: InventoryItem[] = [
      ...inventory(['bourbon']),
      { ...inventory(['bourbon'])[0], id: 'second-bourbon', source: 'product' },
    ];
    const resolved = resolveAvailableIngredients(supplies, {
      'standard-ice': 'unknown',
      'large-ice': 'unknown',
    });

    expect([...resolved.available]).toEqual(['water', 'bourbon']);
    expect(resolved.supplierByIngredient.size).toBe(1);
  });

  it('requires standard ice confirmation for shaken drinks', () => {
    const allButIce = inventory(['bourbon', 'simple-syrup', 'egg-white', 'lemon-juice']);
    const match = matchRecipe(recipeById['whiskey-sour'], allButIce, {
      'standard-ice': 'unknown',
      'large-ice': 'available',
    });

    expect(match.category).toBe('oneAway');
    expect(match.missingRequired).toEqual(['standard-ice']);
    expect(match.unconfirmedStaples).toEqual(['standard-ice']);
    expect(match.explanation).toContain('Confirm standard ice');
  });

  it('does not substitute standard ice for a large serving cube', () => {
    const allButLargeIce = inventory(['bourbon', 'simple-syrup', 'aromatic-bitters']);
    const match = matchRecipe(recipeById['old-fashioned'], allButLargeIce, {
      'standard-ice': 'available',
      'large-ice': 'unknown',
    });
    expect(match.missingRequired).toEqual(['large-ice']);
  });

  it('keeps stable recipe-id ordering when category and score tie', () => {
    const clone = { ...recipeById['old-fashioned'], id: 'bourbon-smash' as const };
    const matches = getRecommendations([recipeById['old-fashioned'], clone], referenceSnapshot());
    expect(matches.map((match) => match.recipe.id)).toEqual(['bourbon-smash', 'old-fashioned']);
  });

  it('keeps unspecified taste neutral and scores actual preferences', () => {
    const profile = recipeById['whiskey-sour'].flavours;
    expect(scoreTaste(profile, {})).toBe(0.5);
    expect(scoreTaste(profile, { sour: { intensity: 0.76, importance: 1 } })).toBeCloseTo(1);
    expect(scoreTaste(profile, { sour: { intensity: 0, importance: 1 } })).toBeCloseTo(0.24);
  });
});

describe('serving conversion', () => {
  it('scales volume while preserving non-scalable ice', () => {
    const recipe = recipeById['whiskey-sour'];
    const bourbon = recipe.requirements.find((requirement) => requirement.id === 'ws-bourbon')!;
    const ice = recipe.requirements.find((requirement) => requirement.id === 'ws-ice')!;

    expect(formatRequirementAmount(bourbon, 2, recipe.baseServings)).toBe('120 ml');
    expect(formatRequirementAmount(ice, 2, recipe.baseServings)).toBe('1 scoop');
  });
});
