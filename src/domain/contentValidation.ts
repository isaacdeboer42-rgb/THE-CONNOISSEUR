import { IngredientId, RecipeVersion } from '@/domain/types';

export interface ContentValidationIssue {
  recipeId: string;
  field: string;
  message: string;
}

const flavourKeys = ['sweet', 'sour', 'salty', 'bitter', 'fruity', 'spiritForward'] as const;

export function validateRecipeContent(
  catalog: readonly RecipeVersion[],
  knownIngredients: ReadonlySet<IngredientId>,
): ContentValidationIssue[] {
  const issues: ContentValidationIssue[] = [];
  const recipeIds = new Set<string>();
  const versionIds = new Set<string>();

  const issue = (recipeId: string, field: string, message: string) => {
    issues.push({ recipeId, field, message });
  };

  catalog.forEach((recipe) => {
    if (recipeIds.has(recipe.id)) issue(recipe.id, 'id', 'Recipe IDs must be unique.');
    if (versionIds.has(recipe.versionId)) issue(recipe.id, 'versionId', 'Version IDs must be unique.');
    recipeIds.add(recipe.id);
    versionIds.add(recipe.versionId);

    if (!recipe.name.trim()) issue(recipe.id, 'name', 'A display name is required.');
    if (!recipe.familyId.trim()) issue(recipe.id, 'familyId', 'A recipe family is required.');
    if (!recipe.variantDescription.trim()) {
      issue(recipe.id, 'variantDescription', 'A variant description is required.');
    }
    if (!Number.isInteger(recipe.version) || recipe.version < 1) {
      issue(recipe.id, 'version', 'Version must be a positive integer.');
    }
    if (!Number.isFinite(recipe.baseServings) || recipe.baseServings <= 0) {
      issue(recipe.id, 'baseServings', 'Base servings must be positive.');
    }
    if (!Number.isFinite(recipe.preparationMinutes) || recipe.preparationMinutes <= 0) {
      issue(recipe.id, 'preparationMinutes', 'Preparation time must be positive.');
    }
    if (!recipe.source.trim()) issue(recipe.id, 'source', 'A source is required.');
    if (!recipe.reviewedBy.trim()) issue(recipe.id, 'reviewedBy', 'An editorial reviewer is required.');
    if (Number.isNaN(Date.parse(recipe.reviewedAt))) {
      issue(recipe.id, 'reviewedAt', 'Editorial review date must be valid.');
    }
    if (recipe.publicationStatus !== 'published') {
      issue(recipe.id, 'publicationStatus', 'Only published recipes belong in the active catalog.');
    }
    if (!recipe.equipment.length || recipe.equipment.some((item) => !item.trim())) {
      issue(recipe.id, 'equipment', 'At least one named equipment item is required.');
    }
    if (!recipe.steps.length) issue(recipe.id, 'steps', 'At least one ordered step is required.');

    const requirementIds = new Set<string>();
    recipe.requirements.forEach((requirement) => {
      if (!requirement.id.trim() || requirementIds.has(requirement.id)) {
        issue(recipe.id, 'requirements', 'Requirement IDs must be present and unique.');
      }
      requirementIds.add(requirement.id);
      if (!Number.isFinite(requirement.amount) || requirement.amount <= 0) {
        issue(recipe.id, `requirements.${requirement.id}.amount`, 'Amount must be positive.');
      }
      if (!requirement.alternatives.length) {
        issue(recipe.id, `requirements.${requirement.id}.alternatives`, 'An ingredient is required.');
      }
      requirement.alternatives.forEach((ingredientId) => {
        if (!knownIngredients.has(ingredientId)) {
          issue(recipe.id, `requirements.${requirement.id}.alternatives`, `Unknown ingredient: ${ingredientId}`);
        }
      });
      if (requirement.garnish && requirement.required) {
        issue(recipe.id, `requirements.${requirement.id}.garnish`, 'Garnishes must remain optional.');
      }
    });

    const stepIds = new Set<string>();
    recipe.steps.forEach((step) => {
      if (!step.id.trim() || stepIds.has(step.id)) {
        issue(recipe.id, 'steps', 'Step IDs must be present and unique.');
      }
      stepIds.add(step.id);
      if (!step.title.trim() || !step.instruction.trim()) {
        issue(recipe.id, `steps.${step.id}`, 'Every step needs a title and instruction.');
      }
      if (step.timerSeconds !== undefined && step.timerSeconds <= 0) {
        issue(recipe.id, `steps.${step.id}.timerSeconds`, 'Timer duration must be positive.');
      }
    });

    flavourKeys.forEach((key) => {
      const value = recipe.flavours[key];
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        issue(recipe.id, `flavours.${key}`, 'Flavour values must be between 0 and 1.');
      }
    });
  });

  return issues;
}
