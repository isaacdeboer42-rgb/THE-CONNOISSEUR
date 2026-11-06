export type IngredientId =
  | 'bourbon'
  | 'simple-syrup'
  | 'egg-white'
  | 'lemon-juice'
  | 'aromatic-bitters'
  | 'mint'
  | 'standard-ice'
  | 'large-ice'
  | 'water'
  | 'orange-peel';

export type BasicId = 'standard-ice' | 'large-ice';

export type RecipeId = 'whiskey-sour' | 'old-fashioned' | 'bourbon-smash';

export type StapleState = 'available' | 'unavailable' | 'unknown';

export type FlavourDimension = 'sweet' | 'sour' | 'salty' | 'bitter' | 'fruity' | 'spiritForward';

export interface TastePreference {
  intensity: number;
  importance: number;
}

export type TastePreferences = Partial<Record<FlavourDimension, TastePreference>>;

export interface SessionPreferences {
  tastes: TastePreferences;
  excludedIngredientIds: IngredientId[];
  selectedSpiritId?: IngredientId;
}

export interface Ingredient {
  id: IngredientId;
  name: string;
  shortName: string;
  category: string;
  aliases: string[];
  isStaple?: boolean;
  isImplicit?: boolean;
  description: string;
}

export interface InventoryItem {
  id: string;
  ingredientId: IngredientId;
  status: 'onHand' | 'outOfStock';
  source: 'generic' | 'product';
  addedAt: string;
  revision: number;
}

export type MeasurementUnit = 'ml' | 'dash' | 'piece' | 'leaf' | 'egg' | 'scoop';

export interface RecipeRequirement {
  id: string;
  alternatives: IngredientId[];
  amount: number;
  unit: MeasurementUnit;
  required: boolean;
  garnish?: boolean;
  scalable: boolean;
  preparation?: string;
}

export interface RecipeStep {
  id: string;
  title: string;
  instruction: string;
  timerSeconds?: number;
  tip?: string;
}

export interface FlavourProfile {
  sweet: number;
  sour: number;
  salty: number;
  bitter: number;
  fruity: number;
  spiritForward: number;
}

export interface RecipeVersion {
  id: RecipeId;
  versionId: string;
  version: number;
  familyId: string;
  name: string;
  eyebrow: string;
  description: string;
  variantDescription: string;
  baseServings: number;
  preparationMinutes: number;
  difficulty: 'Easy' | 'Considered';
  editorialPriority: number;
  accent: string;
  requirements: RecipeRequirement[];
  equipment: string[];
  steps: RecipeStep[];
  flavours: FlavourProfile;
  source: string;
}

export type MatchCategory = 'ready' | 'readyWithSubstitution' | 'oneAway' | 'moreToExplore';

export interface SatisfiedRequirement {
  requirementId: string;
  ingredientId: IngredientId;
  usedSubstitution: boolean;
  suppliedByItemId?: string;
}

export interface MatchResult {
  recipe: RecipeVersion;
  category: MatchCategory;
  satisfied: SatisfiedRequirement[];
  missingRequired: IngredientId[];
  missingOptional: IngredientId[];
  unconfirmedStaples: IngredientId[];
  ingredientCoverage: number;
  tasteMatch: number;
  score: number;
  explanation: string;
}

export interface MakeSession {
  id: string;
  recipeId: RecipeId;
  recipeVersionId: string;
  servings: number;
  stepIndex: number;
  timerTarget?: string;
  timerStepId?: string;
  completedAt?: string;
  feedback?: 'liked' | 'notForMe';
  startedAt: string;
  updatedAt: string;
}

export interface SavedRecipe {
  recipeId: RecipeId;
  savedAt: string;
}

export interface ShoppingItem {
  ingredientId: IngredientId;
  addedAt: string;
  ownedAt?: string;
}

export interface QuickSelectHistoryItem {
  recipeId: RecipeId;
  selectedAt: string;
}

export interface BarSnapshot {
  schemaVersion: 2;
  inventory: InventoryItem[];
  basics: Record<BasicId, StapleState>;
  savedRecipes: SavedRecipe[];
  shoppingItems: ShoppingItem[];
  tastePreferences: TastePreferences;
  sessionPreferences: SessionPreferences;
  quickSelectHistory: QuickSelectHistoryItem[];
  makeSessions: MakeSession[];
  completedGuestImportIds: string[];
  hasOnboarded: boolean;
}

export interface AccountProfile {
  id: string;
  email: string;
  createdAt: string;
}

export type GuestImportStatus = 'idle' | 'pending' | 'failed' | 'confirmed';

export interface GuestImportState {
  importId?: string;
  status: GuestImportStatus;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  mergedInventoryCount?: number;
  mergedSavedCount?: number;
  mergedShoppingCount?: number;
  availabilityConflictCount?: number;
}

export interface PurchaseSuggestion {
  ingredientId: IngredientId;
  newlyReadyFamilyCount: number;
  savedRecipeCount: number;
  getsCloserCount: number;
  supportingRecipeIds: RecipeId[];
  closerRecipeIds: RecipeId[];
  tasteScore: number;
}
