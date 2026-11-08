import {
  CatalogueIngredient,
  CataloguePagination,
  CatalogueRecipe,
  CatalogueRecipeAbv,
  CatalogueRecipeIngredient,
  CatalogueRecipePage,
  CatalogueRecipeSearchOptions,
  CatalogueRepository,
  CatalogueRequestOptions,
  CatalogueStats,
  CatalogueTag,
} from '@/catalogue/types';

export const MIXOLOGY_TOOLS_API_BASE_URL = 'https://mixology.tools/api/v1';

export type CatalogueApiErrorCode =
  | 'aborted'
  | 'http'
  | 'invalid-response'
  | 'network'
  | 'timeout';

export class CatalogueApiError extends Error {
  readonly code: CatalogueApiErrorCode;
  readonly status?: number;
  readonly details?: string;

  constructor(
    code: CatalogueApiErrorCode,
    message: string,
    options: { status?: number; details?: string; cause?: unknown } = {},
  ) {
    super(message);
    this.name = 'CatalogueApiError';
    this.code = code;
    this.status = options.status;
    this.details = options.details;
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

export interface MixologyToolsCatalogueOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

type JsonRecord = Record<string, unknown>;

function invalid(location: string, expectation: string): never {
  throw new CatalogueApiError(
    'invalid-response',
    `The catalogue returned an invalid ${location}; expected ${expectation}.`,
  );
}

function record(value: unknown, location: string): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    invalid(location, 'an object');
  }
  return value as JsonRecord;
}

function stringValue(value: unknown, location: string): string {
  if (typeof value !== 'string') invalid(location, 'a string');
  return value;
}

function numberValue(value: unknown, location: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(location, 'a finite number');
  return value;
}

function integerValue(value: unknown, location: string): number {
  const parsed = numberValue(value, location);
  if (!Number.isInteger(parsed)) invalid(location, 'an integer');
  return parsed;
}

function booleanValue(value: unknown, location: string): boolean {
  if (typeof value !== 'boolean') invalid(location, 'a boolean');
  return value;
}

function optionalString(value: unknown, location: string): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return stringValue(value, location);
}

function optionalNumber(value: unknown, location: string): number | undefined {
  if (value === null || value === undefined) return undefined;
  return numberValue(value, location);
}

function optionalInteger(value: unknown, location: string): number | undefined {
  if (value === null || value === undefined) return undefined;
  return integerValue(value, location);
}

function optionalBoolean(value: unknown, location: string): boolean | undefined {
  if (value === null || value === undefined) return undefined;
  return booleanValue(value, location);
}

function arrayValue(value: unknown, location: string): unknown[] {
  if (!Array.isArray(value)) invalid(location, 'an array');
  return value;
}

function optionalStringArray(value: unknown, location: string): string[] | undefined {
  if (value === null || value === undefined) return undefined;
  return arrayValue(value, location).map((item, index) => stringValue(item, `${location}[${index}]`));
}

function parseRecipeIngredient(value: unknown, index: number): CatalogueRecipeIngredient {
  const item = record(value, `recipe ingredient ${index}`);
  return {
    ingredientId: integerValue(item.ingredient_id, `recipe ingredient ${index}.ingredient_id`),
    ingredientName: stringValue(item.ingredient_name, `recipe ingredient ${index}.ingredient_name`),
    ingredientPath: optionalString(item.ingredient_path, `recipe ingredient ${index}.ingredient_path`),
    fullName: optionalString(item.full_name, `recipe ingredient ${index}.full_name`),
    hierarchy: optionalStringArray(item.hierarchy, `recipe ingredient ${index}.hierarchy`),
    amount: optionalNumber(item.amount, `recipe ingredient ${index}.amount`),
    unitId: optionalInteger(item.unit_id, `recipe ingredient ${index}.unit_id`),
    unitName: optionalString(item.unit_name, `recipe ingredient ${index}.unit_name`),
    unitAbbreviation: optionalString(
      item.unit_abbreviation,
      `recipe ingredient ${index}.unit_abbreviation`,
    ),
  };
}

function parseTag(value: unknown, index: number): CatalogueTag {
  const item = record(value, `recipe tag ${index}`);
  return {
    id: integerValue(item.id, `recipe tag ${index}.id`),
    name: stringValue(item.name, `recipe tag ${index}.name`),
    type: stringValue(item.type, `recipe tag ${index}.type`),
  };
}

function parseAbv(value: unknown): CatalogueRecipeAbv | undefined {
  if (value === null || value === undefined) return undefined;
  const item = record(value, 'recipe abv');
  const status = stringValue(item.status, 'recipe abv.status');
  if (status !== 'calculated' && status !== 'estimated' && status !== 'unknown') {
    invalid('recipe abv.status', 'calculated, estimated, or unknown');
  }
  return {
    status,
    minPercent: optionalNumber(item.min_percent, 'recipe abv.min_percent'),
    maxPercent: optionalNumber(item.max_percent, 'recipe abv.max_percent'),
    display: stringValue(item.display, 'recipe abv.display'),
    notes: item.notes === undefined
      ? []
      : arrayValue(item.notes, 'recipe abv.notes').map((note, index) =>
          stringValue(note, `recipe abv.notes[${index}]`),
        ),
  };
}

function parseRecipe(value: unknown): CatalogueRecipe {
  const item = record(value, 'recipe');
  const ingredients = item.ingredients === undefined
    ? []
    : arrayValue(item.ingredients, 'recipe.ingredients').map(parseRecipeIngredient);
  const tags = item.tags === undefined
    ? []
    : arrayValue(item.tags, 'recipe.tags').map(parseTag);

  return {
    id: integerValue(item.id, 'recipe.id'),
    name: stringValue(item.name, 'recipe.name'),
    instructions: optionalString(item.instructions, 'recipe.instructions'),
    description: optionalString(item.description, 'recipe.description'),
    imageUrl: optionalString(item.image_url, 'recipe.image_url'),
    source: optionalString(item.source, 'recipe.source'),
    sourceUrl: optionalString(item.source_url, 'recipe.source_url'),
    averageRating: optionalNumber(item.avg_rating, 'recipe.avg_rating'),
    ratingCount: optionalInteger(item.rating_count, 'recipe.rating_count'),
    userRating: optionalInteger(item.user_rating, 'recipe.user_rating'),
    createdBy: optionalString(item.created_by, 'recipe.created_by'),
    abv: parseAbv(item.abv),
    ingredients,
    tags,
  };
}

function parsePagination(value: unknown): CataloguePagination {
  const item = record(value, 'pagination');
  return {
    page: integerValue(item.page, 'pagination.page'),
    limit: integerValue(item.limit, 'pagination.limit'),
    totalCount: integerValue(item.total_count, 'pagination.total_count'),
    hasNext: booleanValue(item.has_next, 'pagination.has_next'),
    hasPrevious: booleanValue(item.has_previous, 'pagination.has_previous'),
    nextCursor: optionalString(item.next_cursor, 'pagination.next_cursor'),
  };
}

function parseRecipePage(value: unknown): CatalogueRecipePage {
  const item = record(value, 'recipe search response');
  return {
    recipes: arrayValue(item.recipes, 'recipe search response.recipes').map(parseRecipe),
    pagination: parsePagination(item.pagination),
    query: optionalString(item.query, 'recipe search response.query'),
  };
}

function parseIngredient(value: unknown, index?: number): CatalogueIngredient {
  const prefix = index === undefined ? 'ingredient' : `ingredient ${index}`;
  const item = record(value, prefix);
  return {
    id: integerValue(item.id, `${prefix}.id`),
    name: stringValue(item.name, `${prefix}.name`),
    description: optionalString(item.description, `${prefix}.description`),
    parentId: optionalInteger(item.parent_id, `${prefix}.parent_id`),
    path: optionalString(item.path, `${prefix}.path`),
    allowSubstitution: booleanValue(item.allow_substitution, `${prefix}.allow_substitution`),
    percentAbv: optionalNumber(item.percent_abv, `${prefix}.percent_abv`),
    sugarGramsPerLitre: optionalNumber(item.sugar_g_per_l, `${prefix}.sugar_g_per_l`),
    titratableAcidityGramsPerLitre: optionalNumber(
      item.titratable_acidity_g_per_l,
      `${prefix}.titratable_acidity_g_per_l`,
    ),
    referenceUrl: optionalString(item.url, `${prefix}.url`),
    exactMatch: optionalBoolean(item.exact_match, `${prefix}.exact_match`),
    createdBy: optionalString(item.created_by, `${prefix}.created_by`),
  };
}

function parseStats(value: unknown): CatalogueStats {
  const item = record(value, 'catalogue stats');
  return {
    recipeCount: integerValue(item.recipes_count, 'catalogue stats.recipes_count'),
    ingredientCount: integerValue(item.ingredients_count, 'catalogue stats.ingredients_count'),
  };
}

function setIntegerParameter(params: URLSearchParams, name: string, value: number | undefined, max?: number) {
  if (value === undefined) return;
  if (!Number.isInteger(value) || value < 1 || (max !== undefined && value > max)) {
    throw new RangeError(`${name} must be an integer between 1 and ${max ?? 'Infinity'}.`);
  }
  params.set(name, String(value));
}

function setRatingParameter(params: URLSearchParams, name: string, value: number | undefined) {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < 0 || value > 5) {
    throw new RangeError(`${name} must be between 0 and 5.`);
  }
  params.set(name, String(value));
}

export class MixologyToolsCatalogue implements CatalogueRepository {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: MixologyToolsCatalogueOptions = {}) {
    this.baseUrl = (options.baseUrl ?? MIXOLOGY_TOOLS_API_BASE_URL).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 10_000;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new RangeError('timeoutMs must be a positive number.');
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async searchRecipes(options: CatalogueRecipeSearchOptions = {}): Promise<CatalogueRecipePage> {
    const params = new URLSearchParams();
    if (options.query?.trim()) params.set('q', options.query.trim());
    setIntegerParameter(params, 'page', options.page);
    setIntegerParameter(params, 'limit', options.limit, 1_000);
    if (options.cursor) params.set('cursor', options.cursor);
    if (options.sortBy) params.set('sort_by', options.sortBy);
    if (options.sortOrder) params.set('sort_order', options.sortOrder);
    setRatingParameter(params, 'min_rating', options.minRating);
    setRatingParameter(params, 'max_rating', options.maxRating);
    if (options.tags?.length) params.set('tags', options.tags.join(','));
    if (options.ingredients?.length) params.set('ingredients', options.ingredients.join(','));
    const suffix = params.size ? `?${params.toString()}` : '';
    return parseRecipePage(await this.getJson(`/recipes/search${suffix}`, options.signal));
  }

  async getRecipe(recipeId: number, options: CatalogueRequestOptions = {}): Promise<CatalogueRecipe> {
    if (!Number.isInteger(recipeId) || recipeId < 1) {
      throw new RangeError('recipeId must be a positive integer.');
    }
    return parseRecipe(await this.getJson(`/recipes/${recipeId}`, options.signal));
  }

  async listIngredients(options: CatalogueRequestOptions = {}): Promise<CatalogueIngredient[]> {
    const value = await this.getJson('/ingredients', options.signal);
    return arrayValue(value, 'ingredients response').map(parseIngredient);
  }

  async searchIngredients(
    query: string,
    options: CatalogueRequestOptions = {},
  ): Promise<CatalogueIngredient[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) throw new TypeError('An ingredient search query is required.');
    const params = new URLSearchParams({ q: normalizedQuery });
    const value = await this.getJson(`/ingredients/search?${params.toString()}`, options.signal);
    return arrayValue(value, 'ingredient search response').map(parseIngredient);
  }

  async getStats(options: CatalogueRequestOptions = {}): Promise<CatalogueStats> {
    return parseStats(await this.getJson('/stats', options.signal));
  }

  private async getJson(path: string, externalSignal?: AbortSignal): Promise<unknown> {
    if (externalSignal?.aborted) {
      throw new CatalogueApiError('aborted', 'The catalogue request was cancelled.');
    }

    const controller = new AbortController();
    let timedOut = false;
    const onExternalAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        let details: string | undefined;
        try {
          details = (await response.text()).slice(0, 500) || undefined;
        } catch {
          details = undefined;
        }
        throw new CatalogueApiError(
          'http',
          `The catalogue request failed with status ${response.status}.`,
          { status: response.status, details },
        );
      }

      try {
        return JSON.parse(await response.text()) as unknown;
      } catch (error: unknown) {
        throw new CatalogueApiError(
          'invalid-response',
          'The catalogue returned data that was not valid JSON.',
          { cause: error },
        );
      }
    } catch (error: unknown) {
      if (error instanceof CatalogueApiError) throw error;
      if (timedOut) {
        throw new CatalogueApiError('timeout', 'The catalogue request timed out.', { cause: error });
      }
      if (externalSignal?.aborted) {
        throw new CatalogueApiError('aborted', 'The catalogue request was cancelled.', { cause: error });
      }
      throw new CatalogueApiError(
        'network',
        'The catalogue could not be reached. Check the connection and try again.',
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    }
  }
}

export const mixologyToolsCatalogue = new MixologyToolsCatalogue();
