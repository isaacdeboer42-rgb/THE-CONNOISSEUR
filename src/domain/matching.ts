import { ingredientById } from '@/data/catalog';
import {
  BarSnapshot,
  BasicId,
  IngredientId,
  InventoryItem,
  MatchCategory,
  MatchResult,
  RecipeVersion,
  StapleState,
  TastePreferences,
} from '@/domain/types';
import {
  recommendationScore,
  resolveTastePreferences,
  scoreTaste,
  tasteExplanation,
} from '@/domain/preferences';

const categoryOrder: Record<MatchCategory, number> = {
  ready: 0,
  readyWithSubstitution: 1,
  oneAway: 2,
  moreToExplore: 3,
};

const basicIds: BasicId[] = ['standard-ice', 'large-ice'];

export function resolveAvailableIngredients(
  inventory: InventoryItem[],
  basics: Record<BasicId, StapleState>,
): { available: Set<IngredientId>; supplierByIngredient: Map<IngredientId, string> } {
  const available = new Set<IngredientId>(['water']);
  const supplierByIngredient = new Map<IngredientId, string>();

  for (const item of inventory) {
    if (item.status !== 'onHand') continue;
    available.add(item.ingredientId);
    if (!supplierByIngredient.has(item.ingredientId)) {
      supplierByIngredient.set(item.ingredientId, item.id);
    }
  }

  basicIds.forEach((basicId) => {
    if (basics[basicId] === 'available') available.add(basicId);
  });

  return { available, supplierByIngredient };
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function isBasicId(id: IngredientId): id is BasicId {
  return id === 'standard-ice' || id === 'large-ice';
}

function listNames(ids: IngredientId[]): string {
  const names = ids.map((id) => ingredientById[id].shortName.toLowerCase());
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names.at(-1)}`;
}

export function matchRecipe(
  recipe: RecipeVersion,
  inventory: InventoryItem[],
  basics: Record<BasicId, StapleState>,
  preferences: TastePreferences = {},
): MatchResult {
  const { available, supplierByIngredient } = resolveAvailableIngredients(inventory, basics);
  const required = recipe.requirements.filter((requirement) => requirement.required && !requirement.garnish);
  const optional = recipe.requirements.filter((requirement) => !requirement.required || requirement.garnish);
  const satisfied: MatchResult['satisfied'] = [];
  const missingCandidates: IngredientId[] = [];
  const unconfirmedStaples: IngredientId[] = [];

  for (const requirement of required) {
    const selected = requirement.alternatives.find((ingredientId) => available.has(ingredientId));
    if (selected) {
      satisfied.push({
        requirementId: requirement.id,
        ingredientId: selected,
        usedSubstitution: selected !== requirement.alternatives[0],
        suppliedByItemId: supplierByIngredient.get(selected),
      });
      continue;
    }

    const candidate = requirement.alternatives[0];
    missingCandidates.push(candidate);
    if (isBasicId(candidate) && basics[candidate] === 'unknown') {
      unconfirmedStaples.push(candidate);
    }
  }

  const missingRequired = unique(missingCandidates);
  const missingOptional = unique(
    optional
      .filter((requirement) => !requirement.alternatives.some((ingredientId) => available.has(ingredientId)))
      .map((requirement) => requirement.alternatives[0]),
  );

  const usedSubstitution = satisfied.some((item) => item.usedSubstitution);
  let category: MatchCategory;
  if (missingRequired.length === 0) category = usedSubstitution ? 'readyWithSubstitution' : 'ready';
  else if (missingRequired.length === 1) category = 'oneAway';
  else category = 'moreToExplore';

  const ingredientCoverage = required.length === 0 ? 1 : satisfied.length / required.length;
  const tasteMatch = scoreTaste(recipe.flavours, preferences);
  const score = recommendationScore(tasteMatch, ingredientCoverage, recipe.editorialPriority);
  const tasteReason = tasteExplanation(recipe.flavours, preferences);

  const ownedIds = unique(
    satisfied
      .map((item) => item.ingredientId)
      .filter((id) => !isBasicId(id) && id !== 'water'),
  );

  let explanation: string;
  if (category === 'ready' || category === 'readyWithSubstitution') {
    const readiness = `Everything you need is in your bar${missingOptional.length ? '; garnish is optional' : ''}.`;
    explanation = tasteReason ? `${readiness} ${tasteReason}` : readiness;
  } else if (unconfirmedStaples.length && missingRequired.length === unconfirmedStaples.length) {
    explanation = `Confirm ${listNames(unconfirmedStaples)} to check readiness.`;
  } else {
    const confirmedMissing = missingRequired.filter((id) => !unconfirmedStaples.includes(id));
    const have = ownedIds.length ? `You have ${listNames(ownedIds)}. ` : '';
    const add = confirmedMissing.length ? `Add ${listNames(confirmedMissing)}.` : '';
    const confirm = unconfirmedStaples.length ? ` Confirm ${listNames(unconfirmedStaples)}.` : '';
    const preferenceReason = tasteReason ? ` ${tasteReason}` : '';
    explanation = `${have}${add}${confirm}${preferenceReason}`.trim();
  }

  return {
    recipe,
    category,
    satisfied,
    missingRequired,
    missingOptional,
    unconfirmedStaples: unique(unconfirmedStaples),
    ingredientCoverage,
    tasteMatch,
    score,
    explanation,
  };
}

function recipeMatchesHardFilters(
  recipe: RecipeVersion,
  snapshot: Pick<BarSnapshot, 'sessionPreferences'>,
): boolean {
  const { excludedIngredientIds, selectedSpiritId } = snapshot.sessionPreferences;
  const requiredIds = recipe.requirements
    .filter((requirement) => requirement.required && !requirement.garnish)
    .flatMap((requirement) => requirement.alternatives);
  if (excludedIngredientIds.some((id) => requiredIds.includes(id))) return false;
  if (selectedSpiritId && !requiredIds.includes(selectedSpiritId)) return false;
  return true;
}

export function getRecommendations(
  recipes: RecipeVersion[],
  snapshot: Pick<
    BarSnapshot,
    'inventory' | 'basics' | 'tastePreferences' | 'sessionPreferences'
  >,
): MatchResult[] {
  const preferences = resolveTastePreferences(snapshot.tastePreferences, snapshot.sessionPreferences);
  return recipes
    .filter((recipe) => recipeMatchesHardFilters(recipe, snapshot))
    .map((recipe) => matchRecipe(recipe, snapshot.inventory, snapshot.basics, preferences))
    .sort((left, right) => {
      const categoryDifference = categoryOrder[left.category] - categoryOrder[right.category];
      if (categoryDifference !== 0) return categoryDifference;
      const scoreDifference = right.score - left.score;
      if (Math.abs(scoreDifference) > Number.EPSILON) return scoreDifference;
      return left.recipe.id.localeCompare(right.recipe.id);
    });
}

export function categoryLabel(category: MatchCategory): string {
  const labels: Record<MatchCategory, string> = {
    ready: 'Ready to make',
    readyWithSubstitution: 'Ready with a substitution',
    oneAway: 'One ingredient away',
    moreToExplore: 'More to explore',
  };
  return labels[category];
}
