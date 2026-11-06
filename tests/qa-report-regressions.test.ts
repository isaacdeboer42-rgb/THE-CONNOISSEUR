import { describe, expect, it } from 'vitest';

import { recipes } from '@/data/catalog';
import { patchForRequestedServings } from '@/domain/makeSessions';
import { matchRecipe } from '@/domain/matching';
import { SAMPLE_INGREDIENT_IDS } from '@/domain/onboarding';
import { withoutFeaturedRecipe } from '@/domain/recommendationPresentation';
import { MakeSession, MatchResult, RecipeVersion } from '@/domain/types';

describe('QA report regression coverage', () => {
  it('keeps the research sample to bourbon, syrup and egg white', () => {
    expect(SAMPLE_INGREDIENT_IDS).toEqual(['bourbon', 'simple-syrup', 'egg-white']);
    expect(SAMPLE_INGREDIENT_IDS).not.toContain('lemon-juice');
  });

  it('restarts preflight when requested servings differ from an unfinished session', () => {
    const session: MakeSession = {
      id: 'make-1',
      recipeId: 'old-fashioned',
      recipeVersionId: 'old-fashioned-v1',
      servings: 1,
      stepIndex: 1,
      timerTarget: '2026-11-06T00:01:00.000Z',
      timerStepId: 'of-stir',
      startedAt: '2026-11-06T00:00:00.000Z',
      updatedAt: '2026-11-06T00:00:10.000Z',
    };

    expect(patchForRequestedServings(session, 3, '2026-11-06T00:02:00.000Z')).toEqual({
      servings: 3,
      stepIndex: -1,
      timerTarget: undefined,
      timerStepId: undefined,
      updatedAt: '2026-11-06T00:02:00.000Z',
    });
    expect(patchForRequestedServings(session, 1, '2026-11-06T00:02:00.000Z')).toBeUndefined();
  });

  it('never repeats the featured recipe in More to explore', () => {
    const matches = recipes.slice(0, 2).map((recipe) => ({ recipe } as MatchResult));
    expect(withoutFeaturedRecipe(matches, matches[0]).map((match) => match.recipe.id)).toEqual([
      matches[1].recipe.id,
    ]);
  });

  it('falls back safely when an editorial requirement references an unknown ingredient', () => {
    const malformed = {
      ...recipes[0],
      requirements: [
        {
          ...recipes[0].requirements[0],
          alternatives: ['future-ingredient'],
        },
      ],
    } as unknown as RecipeVersion;

    expect(() =>
      matchRecipe(malformed, [], { 'standard-ice': 'available', 'large-ice': 'available' }),
    ).not.toThrow();
  });
});
