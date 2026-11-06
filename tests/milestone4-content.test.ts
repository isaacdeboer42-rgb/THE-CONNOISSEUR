import { describe, expect, it } from 'vitest';

import { ingredients, recipes } from '@/data/catalog';
import { validateRecipeContent } from '@/domain/contentValidation';
import { createEmptySnapshot, normalizeBarSnapshot } from '@/domain/persistence';
import { IngredientId, RecipeVersion } from '@/domain/types';

const ingredientIds = new Set(ingredients.map((ingredient) => ingredient.id as IngredientId));

describe('Milestone 4 content and lifecycle gates', () => {
  it('publishes only recipes that satisfy the editorial contract', () => {
    expect(validateRecipeContent(recipes, ingredientIds)).toEqual([]);
  });

  it('reports malformed quantities, required garnishes, and missing review evidence', () => {
    const malformed: RecipeVersion = {
      ...recipes[0],
      reviewedAt: 'not-a-date',
      requirements: recipes[0].requirements.map((requirement, index) =>
        index === 0
          ? { ...requirement, amount: 0, garnish: true, required: true }
          : requirement,
      ),
    };

    const fields = validateRecipeContent([malformed], ingredientIds).map((issue) => issue.field);
    expect(fields).toContain('reviewedAt');
    expect(fields).toContain(`requirements.${malformed.requirements[0].id}.amount`);
    expect(fields).toContain(`requirements.${malformed.requirements[0].id}.garnish`);
  });

  it('retains a withdrawn saved reference without making it recommendable', () => {
    const snapshot = normalizeBarSnapshot({
      ...createEmptySnapshot(),
      savedRecipes: [{ recipeId: 'classic-martini', savedAt: '2026-11-06T00:00:00.000Z' }],
    });

    expect(snapshot.savedRecipes).toEqual([
      { recipeId: 'classic-martini', savedAt: '2026-11-06T00:00:00.000Z' },
    ]);
    expect(recipes.some((recipe) => recipe.id === ('classic-martini' as never))).toBe(false);
  });

  it('keeps private notes only for completed sessions and caps them at 500 characters', () => {
    const base = createEmptySnapshot();
    const session = {
      id: 'make-1',
      recipeId: 'old-fashioned',
      recipeVersionId: 'old-fashioned-v1',
      servings: 1,
      stepIndex: 2,
      completedAt: '2026-11-06T00:05:00.000Z',
      feedback: 'liked',
      feedbackNote: `  ${'a'.repeat(520)}  `,
      startedAt: '2026-11-06T00:00:00.000Z',
      updatedAt: '2026-11-06T00:05:00.000Z',
    };

    const completed = normalizeBarSnapshot({ ...base, makeSessions: [session] });
    expect(completed.makeSessions[0].feedbackNote).toHaveLength(500);

    const incomplete = normalizeBarSnapshot({
      ...base,
      makeSessions: [{ ...session, completedAt: undefined }],
    });
    expect(incomplete.makeSessions[0].feedbackNote).toBeUndefined();
    expect(incomplete.makeSessions[0].feedback).toBeUndefined();
  });
});
