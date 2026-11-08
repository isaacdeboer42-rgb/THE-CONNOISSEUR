export type CatalogueAbvStatus = 'calculated' | 'estimated' | 'unknown';

export interface CatalogueRecipeAbv {
  status: CatalogueAbvStatus;
  minPercent?: number;
  maxPercent?: number;
  display: string;
  notes: string[];
}

export interface CatalogueRecipeIngredient {
  ingredientId: number;
  ingredientName: string;
  ingredientPath?: string;
  fullName?: string;
  hierarchy?: string[];
  amount?: number;
  unitId?: number;
  unitName?: string;
  unitAbbreviation?: string;
}

export interface CatalogueTag {
  id: number;
  name: string;
  type: string;
}

export interface CatalogueRecipe {
  id: number;
  name: string;
  instructions?: string;
  description?: string;
  imageUrl?: string;
  source?: string;
  sourceUrl?: string;
  averageRating?: number;
  ratingCount?: number;
  userRating?: number;
  createdBy?: string;
  abv?: CatalogueRecipeAbv;
  ingredients: CatalogueRecipeIngredient[];
  tags: CatalogueTag[];
}

export interface CataloguePagination {
  page: number;
  limit: number;
  totalCount: number;
  hasNext: boolean;
  hasPrevious: boolean;
  nextCursor?: string;
}

export interface CatalogueRecipePage {
  recipes: CatalogueRecipe[];
  pagination: CataloguePagination;
  query?: string;
}

export interface CatalogueIngredient {
  id: number;
  name: string;
  description?: string;
  parentId?: number;
  path?: string;
  allowSubstitution: boolean;
  percentAbv?: number;
  sugarGramsPerLitre?: number;
  titratableAcidityGramsPerLitre?: number;
  referenceUrl?: string;
  exactMatch?: boolean;
  createdBy?: string;
}

export interface CatalogueStats {
  recipeCount: number;
  ingredientCount: number;
}

export type CatalogueRecipeSort = 'name' | 'created_at' | 'avg_rating' | 'rating_count' | 'random';
export type CatalogueSortOrder = 'asc' | 'desc';

export interface CatalogueRequestOptions {
  signal?: AbortSignal;
}

export interface CatalogueRecipeSearchOptions extends CatalogueRequestOptions {
  query?: string;
  page?: number;
  limit?: number;
  cursor?: string;
  sortBy?: CatalogueRecipeSort;
  sortOrder?: CatalogueSortOrder;
  minRating?: number;
  maxRating?: number;
  tags?: string[];
  ingredients?: string[];
}

export interface CatalogueRepository {
  searchRecipes(options?: CatalogueRecipeSearchOptions): Promise<CatalogueRecipePage>;
  getRecipe(recipeId: number, options?: CatalogueRequestOptions): Promise<CatalogueRecipe>;
  listIngredients(options?: CatalogueRequestOptions): Promise<CatalogueIngredient[]>;
  searchIngredients(query: string, options?: CatalogueRequestOptions): Promise<CatalogueIngredient[]>;
  getStats(options?: CatalogueRequestOptions): Promise<CatalogueStats>;
}
