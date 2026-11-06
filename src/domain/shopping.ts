import { ingredients, recipes } from '@/data/catalog';
import { getRecommendations } from '@/domain/matching';
import {
  BarSnapshot,
  IngredientId,
  InventoryItem,
  MatchResult,
  PurchaseSuggestion,
  RecipeId,
} from '@/domain/types';

function isDirectlyReady(match: MatchResult): boolean {
  return match.category === 'ready';
}

function candidateInventoryItem(ingredientId: IngredientId): InventoryItem {
  return {
    id: `simulation-${ingredientId}`,
    ingredientId,
    status: 'onHand',
    source: 'generic',
    addedAt: 'simulation',
    revision: 1,
  };
}

export function getPurchaseSuggestions(snapshot: BarSnapshot): PurchaseSuggestion[] {
  const baseline = getRecommendations(recipes, snapshot);
  const baselineById = new Map(baseline.map((match) => [match.recipe.id, match]));
  const baselineReadyFamilies = new Set(
    baseline.filter(isDirectlyReady).map((match) => match.recipe.familyId),
  );
  const owned = new Set(
    snapshot.inventory
      .filter((item) => item.status === 'onHand')
      .map((item) => item.ingredientId),
  );

  return ingredients
    .filter(
      (ingredient) =>
        !ingredient.isStaple &&
        !ingredient.isImplicit &&
        ingredient.id !== 'orange-peel' &&
        !owned.has(ingredient.id),
    )
    .map((ingredient) => {
      const simulatedSnapshot: BarSnapshot = {
        ...snapshot,
        inventory: [...snapshot.inventory, candidateInventoryItem(ingredient.id)],
      };
      const simulated = getRecommendations(recipes, simulatedSnapshot);
      const newlyReady = simulated.filter(
        (match) => isDirectlyReady(match) && !baselineReadyFamilies.has(match.recipe.familyId),
      );
      const newFamilyIds = new Set(newlyReady.map((match) => match.recipe.familyId));
      const supporting = simulated.filter(
        (match) => isDirectlyReady(match) && newFamilyIds.has(match.recipe.familyId),
      );
      const savedRecipeCount = snapshot.savedRecipes.filter((saved) => {
        if (saved.recipeId === 'classic-martini') return false;
        const before = baselineById.get(saved.recipeId);
        const after = simulated.find((match) => match.recipe.id === saved.recipeId);
        return Boolean(before && after && !isDirectlyReady(before) && isDirectlyReady(after));
      }).length;
      const closerRecipeIds = simulated.flatMap((after) => {
        const before = baselineById.get(after.recipe.id);
        if (
          !before ||
          isDirectlyReady(after) ||
          after.missingRequired.length >= before.missingRequired.length
        ) {
          return [];
        }
        return [after.recipe.id];
      });
      const tasteScore = supporting.length
        ? supporting.reduce((total, match) => total + match.tasteMatch, 0) / supporting.length
        : closerRecipeIds.reduce((total, recipeId) => {
            return total + (simulated.find((match) => match.recipe.id === recipeId)?.tasteMatch ?? 0);
          }, 0) / Math.max(1, closerRecipeIds.length);

      return {
        ingredientId: ingredient.id,
        newlyReadyFamilyCount: newFamilyIds.size,
        savedRecipeCount,
        getsCloserCount: closerRecipeIds.length,
        supportingRecipeIds: supporting.map((match) => match.recipe.id),
        closerRecipeIds,
        tasteScore,
      };
    })
    .filter(
      (suggestion) =>
        suggestion.newlyReadyFamilyCount > 0 || suggestion.getsCloserCount > 0 || suggestion.savedRecipeCount > 0,
    );
}

export function linkedRecipeIds(ingredientId: IngredientId): RecipeId[] {
  return recipes
    .filter((recipe) =>
      recipe.requirements.some(
        (requirement) => requirement.required && requirement.alternatives.includes(ingredientId),
      ),
    )
    .map((recipe) => recipe.id);
}
