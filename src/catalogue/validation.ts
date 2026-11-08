import type { CatalogueRecipe } from '@/catalogue/types';

export type CatalogueAuditSeverity = 'blocking' | 'warning';

export interface CatalogueAuditIssue {
  code: string;
  field: string;
  message: string;
  severity: CatalogueAuditSeverity;
}

export interface CatalogueRecipeAudit {
  makeReady: boolean;
  status: 'structurally-complete' | 'needs-review';
  issues: CatalogueAuditIssue[];
}

const QUALITATIVE_MEASURES = new Set(['top', 'to top', 'rinse', 'to rinse']);

function isQualitativeMeasure(unitAbbreviation?: string, unitName?: string): boolean {
  const values = [unitAbbreviation, unitName]
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value));
  return values.some((value) => QUALITATIVE_MEASURES.has(value));
}

export function auditCatalogueRecipe(recipe: CatalogueRecipe): CatalogueRecipeAudit {
  const issues: CatalogueAuditIssue[] = [];
  const add = (
    code: string,
    field: string,
    message: string,
    severity: CatalogueAuditSeverity = 'blocking',
  ) => issues.push({ code, field, message, severity });

  if (!recipe.name.trim()) add('missing-name', 'name', 'A recipe name is required.');
  if (!recipe.instructions?.trim()) {
    add('missing-instructions', 'instructions', 'Instructions are required before Make mode can start.');
  }
  if (!recipe.ingredients.length) {
    add('missing-ingredients', 'ingredients', 'At least one ingredient is required.');
  }
  if (!recipe.sourceUrl?.trim() && !recipe.source?.trim()) {
    add('missing-source', 'source', 'No source identity is attached to this recipe.', 'warning');
  }

  const seenIngredientIds = new Set<number>();
  recipe.ingredients.forEach((ingredient, index) => {
    const field = `ingredients.${index}`;
    const qualitativeMeasure = isQualitativeMeasure(ingredient.unitAbbreviation, ingredient.unitName);
    if (!Number.isInteger(ingredient.ingredientId) || ingredient.ingredientId <= 0) {
      add('invalid-ingredient-id', `${field}.ingredientId`, 'The ingredient reference is invalid.');
    }
    if (!ingredient.ingredientName.trim()) {
      add('missing-ingredient-name', `${field}.ingredientName`, 'The ingredient name is missing.');
    }
    if (
      !qualitativeMeasure
      && (ingredient.amount === undefined || !Number.isFinite(ingredient.amount) || ingredient.amount <= 0)
    ) {
      add('missing-amount', `${field}.amount`, `${ingredient.ingredientName || 'Ingredient'} needs a positive quantity.`);
    }
    if (!ingredient.unitAbbreviation?.trim() && !ingredient.unitName?.trim()) {
      add('missing-unit', `${field}.unit`, `${ingredient.ingredientName || 'Ingredient'} needs a measurement unit.`);
    }
    if (seenIngredientIds.has(ingredient.ingredientId)) {
      add(
        'duplicate-ingredient',
        `${field}.ingredientId`,
        `${ingredient.ingredientName} appears more than once; confirm that the duplication is intentional.`,
        'warning',
      );
    }
    seenIngredientIds.add(ingredient.ingredientId);
  });

  add(
    'editorial-verification-required',
    'editorialReview',
    'Quantities, method, source rights, substitutions and serving assumptions still require human editorial verification.',
    'warning',
  );

  const makeReady = !issues.some((issue) => issue.severity === 'blocking');
  return {
    makeReady,
    status: makeReady ? 'structurally-complete' : 'needs-review',
    issues,
  };
}

export function isCatalogueRecipeVisible(recipe: CatalogueRecipe): boolean {
  return auditCatalogueRecipe(recipe).makeReady;
}
