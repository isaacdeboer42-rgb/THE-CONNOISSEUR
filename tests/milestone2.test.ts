import { describe, expect, it } from 'vitest';

import { recipes } from '@/data/catalog';
import { getRecommendations } from '@/domain/matching';
import {
  createEmptySnapshot,
  mergeGuestIntoAccount,
  normalizeBarSnapshot,
  normalizePersistedAppData,
} from '@/domain/persistence';
import { quickSelectCandidates, selectQuickRecipe } from '@/domain/quickSelect';
import { getPurchaseSuggestions } from '@/domain/shopping';
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

function allReadySnapshot(): BarSnapshot {
  return {
    ...createEmptySnapshot(),
    inventory: inventory([
      'bourbon',
      'simple-syrup',
      'egg-white',
      'lemon-juice',
      'aromatic-bitters',
      'mint',
    ]),
    basics: { 'standard-ice': 'available', 'large-ice': 'available' },
  };
}

describe('Quick Select', () => {
  it('defaults to direct-ready recipes and avoids the previous five while unseen choices remain', () => {
    const matches = getRecommendations(recipes, allReadySnapshot());
    const history = matches.slice(0, 2).map((match, index) => ({
      recipeId: match.recipe.id,
      selectedAt: `2026-01-0${index + 1}T00:00:00.000Z`,
    }));
    const candidates = quickSelectCandidates(matches, history);
    expect(candidates).toHaveLength(1);
    expect(history.map((item) => item.recipeId)).not.toContain(candidates[0].recipe.id);
    expect(selectQuickRecipe(matches, history, { random: () => 0 })?.recipe.id).toBe(candidates[0].recipe.id);
  });

  it('requires deliberate one-away expansion when nothing is directly ready', () => {
    const matches = getRecommendations(recipes, referenceSnapshot());
    expect(selectQuickRecipe(matches, [], { random: () => 0 })).toBeUndefined();
    expect(selectQuickRecipe(matches, [], { allowOneAway: true, random: () => 0 })?.category).toBe('oneAway');
  });
});

describe('shopping simulation', () => {
  it('counts newly ready families, saved variants, and closer recipes separately', () => {
    const snapshot = referenceSnapshot();
    snapshot.savedRecipes = [{ recipeId: 'whiskey-sour', savedAt: '2026-01-01T00:00:00.000Z' }];
    const lemon = getPurchaseSuggestions(snapshot).find((item) => item.ingredientId === 'lemon-juice');
    expect(lemon?.newlyReadyFamilyCount).toBe(1);
    expect(lemon?.savedRecipeCount).toBe(1);
    expect(lemon?.supportingRecipeIds).toEqual(['whiskey-sour']);
    expect(lemon?.closerRecipeIds).toContain('bourbon-smash');
  });
});

describe('schema and guest import migration', () => {
  it('migrates v1 ice and saved IDs without inventing large ice', () => {
    const migrated = normalizeBarSnapshot({
      inventory: inventory(['bourbon']),
      staples: { ice: 'available', water: 'unavailable' },
      savedRecipeIds: ['whiskey-sour'],
      makeSessions: [],
      hasOnboarded: true,
    });
    expect(migrated.basics).toEqual({ 'standard-ice': 'available', 'large-ice': 'unknown' });
    expect(migrated.savedRecipes.map((item) => item.recipeId)).toEqual(['whiskey-sour']);
    expect(migrated.inventory.some((item) => item.ingredientId === 'water')).toBe(false);
  });

  it('recognises a raw v1 snapshot as guest data', () => {
    const data = normalizePersistedAppData({ inventory: [], staples: { ice: 'unknown' }, savedRecipeIds: [] });
    expect(data.schemaVersion).toBe(2);
    expect(data.importState.status).toBe('idle');
  });

  it('merges saves and shopping idempotently while retaining the guest source', () => {
    const account = createEmptySnapshot();
    const guest = referenceSnapshot();
    guest.savedRecipes = [{ recipeId: 'whiskey-sour', savedAt: '2026-01-01T00:00:00.000Z' }];
    guest.shoppingItems = [{ ingredientId: 'lemon-juice', addedAt: '2026-01-01T00:00:00.000Z' }];
    const first = mergeGuestIntoAccount(account, guest, 'stable-import');
    const second = mergeGuestIntoAccount(first.snapshot, guest, 'stable-import');

    expect(first.snapshot.inventory).toHaveLength(guest.inventory.length);
    expect(first.snapshot.savedRecipes).toHaveLength(1);
    expect(first.snapshot.shoppingItems).toHaveLength(1);
    expect(second.alreadyImported).toBe(true);
    expect(second.snapshot.savedRecipes).toHaveLength(1);
    expect(guest.completedGuestImportIds).toEqual([]);
  });
});
