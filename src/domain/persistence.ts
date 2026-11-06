import {
  AccountProfile,
  BarSnapshot,
  BasicId,
  GuestImportState,
  IngredientId,
  InventoryItem,
  MakeSession,
  RecipeId,
  SavedRecipe,
  ShoppingItem,
  StapleState,
  TastePreferences,
} from '@/domain/types';

export interface LocalAccountRecord {
  profile: AccountProfile;
  snapshot: BarSnapshot;
}

export interface PersistedAppDataV2 {
  schemaVersion: 2;
  guest: BarSnapshot;
  account?: LocalAccountRecord;
  signedIn: boolean;
  importState: GuestImportState;
}

export interface GuestImportReport {
  snapshot: BarSnapshot;
  inventoryAdded: number;
  savedAdded: number;
  shoppingAdded: number;
  availabilityConflictCount: number;
  alreadyImported: boolean;
}

const ingredientIds = new Set<IngredientId>([
  'bourbon',
  'simple-syrup',
  'egg-white',
  'lemon-juice',
  'aromatic-bitters',
  'mint',
  'standard-ice',
  'large-ice',
  'water',
  'orange-peel',
]);

const recipeIds = new Set<RecipeId>(['whiskey-sour', 'old-fashioned', 'bourbon-smash']);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function validStapleState(value: unknown): StapleState {
  return value === 'available' || value === 'unavailable' || value === 'unknown' ? value : 'unknown';
}

export function createEmptySnapshot(): BarSnapshot {
  return {
    schemaVersion: 2,
    inventory: [],
    basics: { 'standard-ice': 'unknown', 'large-ice': 'unknown' },
    savedRecipes: [],
    shoppingItems: [],
    tastePreferences: {},
    sessionPreferences: { tastes: {}, excludedIngredientIds: [] },
    quickSelectHistory: [],
    makeSessions: [],
    completedGuestImportIds: [],
    hasOnboarded: false,
  };
}

function normalizeInventory(value: unknown): InventoryItem[] {
  if (!Array.isArray(value)) return [];
  const byKey = new Map<string, InventoryItem>();
  value.forEach((raw, index) => {
    const item = record(raw);
    const ingredientId = item.ingredientId;
    if (typeof ingredientId !== 'string' || !ingredientIds.has(ingredientId as IngredientId)) return;
    const normalized: InventoryItem = {
      id: typeof item.id === 'string' ? item.id : `generic-${ingredientId}-${index}`,
      ingredientId: ingredientId as IngredientId,
      status: item.status === 'outOfStock' ? 'outOfStock' : 'onHand',
      source: item.source === 'product' ? 'product' : 'generic',
      addedAt: typeof item.addedAt === 'string' ? item.addedAt : new Date(0).toISOString(),
      revision: typeof item.revision === 'number' ? item.revision : 1,
    };
    byKey.set(`${normalized.source}:${normalized.ingredientId}`, normalized);
  });
  return [...byKey.values()];
}

function normalizeSaved(value: unknown, legacyIds: unknown): SavedRecipe[] {
  const normalized = new Map<RecipeId, SavedRecipe>();
  if (Array.isArray(value)) {
    value.forEach((raw) => {
      const item = record(raw);
      if (typeof item.recipeId !== 'string' || !recipeIds.has(item.recipeId as RecipeId)) return;
      normalized.set(item.recipeId as RecipeId, {
        recipeId: item.recipeId as RecipeId,
        savedAt: typeof item.savedAt === 'string' ? item.savedAt : new Date(0).toISOString(),
      });
    });
  }
  if (Array.isArray(legacyIds)) {
    legacyIds.forEach((id) => {
      if (typeof id === 'string' && recipeIds.has(id as RecipeId) && !normalized.has(id as RecipeId)) {
        normalized.set(id as RecipeId, { recipeId: id as RecipeId, savedAt: new Date(0).toISOString() });
      }
    });
  }
  return [...normalized.values()];
}

function normalizeShopping(value: unknown): ShoppingItem[] {
  if (!Array.isArray(value)) return [];
  const normalized = new Map<IngredientId, ShoppingItem>();
  value.forEach((raw) => {
    const item = record(raw);
    if (typeof item.ingredientId !== 'string' || !ingredientIds.has(item.ingredientId as IngredientId)) return;
    normalized.set(item.ingredientId as IngredientId, {
      ingredientId: item.ingredientId as IngredientId,
      addedAt: typeof item.addedAt === 'string' ? item.addedAt : new Date(0).toISOString(),
      ownedAt: typeof item.ownedAt === 'string' ? item.ownedAt : undefined,
    });
  });
  return [...normalized.values()];
}

function normalizePreferences(value: unknown): TastePreferences {
  const source = record(value);
  const result: TastePreferences = {};
  (['sweet', 'sour', 'salty', 'bitter', 'fruity', 'spiritForward'] as const).forEach((dimension) => {
    const preference = record(source[dimension]);
    if (typeof preference.intensity !== 'number' || typeof preference.importance !== 'number') return;
    result[dimension] = {
      intensity: Math.max(0, Math.min(1, preference.intensity)),
      importance: Math.max(0, Math.min(1, preference.importance)),
    };
  });
  return result;
}

export function normalizeBarSnapshot(value: unknown): BarSnapshot {
  const source = record(value);
  const legacyStaples = record(source.staples);
  const basicsSource = record(source.basics);
  const oldIce = validStapleState(legacyStaples.ice);
  const basics: Record<BasicId, StapleState> = {
    'standard-ice': validStapleState(basicsSource['standard-ice'] ?? oldIce),
    'large-ice': validStapleState(basicsSource['large-ice']),
  };
  const session = record(source.sessionPreferences);
  const excluded = Array.isArray(session.excludedIngredientIds)
    ? session.excludedIngredientIds.filter(
        (id): id is IngredientId => typeof id === 'string' && ingredientIds.has(id as IngredientId),
      )
    : [];
  const selectedSpiritId =
    typeof session.selectedSpiritId === 'string' && ingredientIds.has(session.selectedSpiritId as IngredientId)
      ? (session.selectedSpiritId as IngredientId)
      : undefined;

  return {
    ...createEmptySnapshot(),
    inventory: normalizeInventory(source.inventory),
    basics,
    savedRecipes: normalizeSaved(source.savedRecipes, source.savedRecipeIds),
    shoppingItems: normalizeShopping(source.shoppingItems),
    tastePreferences: normalizePreferences(source.tastePreferences),
    sessionPreferences: {
      tastes: normalizePreferences(record(session).tastes),
      excludedIngredientIds: excluded,
      selectedSpiritId,
    },
    quickSelectHistory: Array.isArray(source.quickSelectHistory)
      ? source.quickSelectHistory.flatMap((raw) => {
          const item = record(raw);
          if (typeof item.recipeId !== 'string' || !recipeIds.has(item.recipeId as RecipeId)) return [];
          return [{
            recipeId: item.recipeId as RecipeId,
            selectedAt: typeof item.selectedAt === 'string' ? item.selectedAt : new Date(0).toISOString(),
          }];
        }).slice(-5)
      : [],
    makeSessions: Array.isArray(source.makeSessions) ? (source.makeSessions as MakeSession[]) : [],
    completedGuestImportIds: Array.isArray(source.completedGuestImportIds)
      ? source.completedGuestImportIds.filter((id): id is string => typeof id === 'string')
      : [],
    hasOnboarded: Boolean(source.hasOnboarded),
  };
}

export function normalizePersistedAppData(value: unknown): PersistedAppDataV2 {
  const source = record(value);
  if (source.schemaVersion === 2 && source.guest) {
    const accountSource = record(source.account);
    const profileSource = record(accountSource.profile);
    const account =
      typeof profileSource.id === 'string' && typeof profileSource.email === 'string'
        ? {
            profile: {
              id: profileSource.id,
              email: profileSource.email,
              createdAt:
                typeof profileSource.createdAt === 'string'
                  ? profileSource.createdAt
                  : new Date(0).toISOString(),
            },
            snapshot: normalizeBarSnapshot(accountSource.snapshot),
          }
        : undefined;
    const importSource = record(source.importState);
    const status =
      importSource.status === 'pending' ||
      importSource.status === 'failed' ||
      importSource.status === 'confirmed'
        ? importSource.status
        : 'idle';
    return {
      schemaVersion: 2,
      guest: normalizeBarSnapshot(source.guest),
      account,
      signedIn: Boolean(source.signedIn && account),
      importState: {
        status,
        importId: typeof importSource.importId === 'string' ? importSource.importId : undefined,
        startedAt: typeof importSource.startedAt === 'string' ? importSource.startedAt : undefined,
        completedAt: typeof importSource.completedAt === 'string' ? importSource.completedAt : undefined,
        error: typeof importSource.error === 'string' ? importSource.error : undefined,
        mergedInventoryCount: typeof importSource.mergedInventoryCount === 'number' ? importSource.mergedInventoryCount : undefined,
        mergedSavedCount: typeof importSource.mergedSavedCount === 'number' ? importSource.mergedSavedCount : undefined,
        mergedShoppingCount: typeof importSource.mergedShoppingCount === 'number' ? importSource.mergedShoppingCount : undefined,
        availabilityConflictCount: typeof importSource.availabilityConflictCount === 'number' ? importSource.availabilityConflictCount : undefined,
      },
    };
  }
  return {
    schemaVersion: 2,
    guest: normalizeBarSnapshot(value),
    signedIn: false,
    importState: { status: 'idle' },
  };
}

export function mergeGuestIntoAccount(
  account: BarSnapshot,
  guest: BarSnapshot,
  importId: string,
  useGuestPreferences = false,
): GuestImportReport {
  if (account.completedGuestImportIds.includes(importId)) {
    return {
      snapshot: account,
      inventoryAdded: 0,
      savedAdded: 0,
      shoppingAdded: 0,
      availabilityConflictCount: 0,
      alreadyImported: true,
    };
  }

  const inventory = new Map(account.inventory.map((item) => [`${item.source}:${item.ingredientId}`, item]));
  let availabilityConflictCount = 0;
  let inventoryAdded = 0;
  guest.inventory.forEach((item) => {
    const key = `${item.source}:${item.ingredientId}`;
    const existing = inventory.get(key);
    if (!existing) {
      inventory.set(key, item);
      inventoryAdded += 1;
    } else if (existing.status !== item.status) {
      availabilityConflictCount += 1;
    }
  });

  const saved = new Map(account.savedRecipes.map((item) => [item.recipeId, item]));
  let savedAdded = 0;
  guest.savedRecipes.forEach((item) => {
    if (!saved.has(item.recipeId)) {
      saved.set(item.recipeId, item);
      savedAdded += 1;
    }
  });

  const shopping = new Map(account.shoppingItems.map((item) => [item.ingredientId, item]));
  let shoppingAdded = 0;
  guest.shoppingItems.forEach((item) => {
    if (!shopping.has(item.ingredientId)) {
      shopping.set(item.ingredientId, item);
      shoppingAdded += 1;
    }
  });

  const sessions = new Map(account.makeSessions.map((session) => [session.id, session]));
  guest.makeSessions.forEach((session) => {
    if (!sessions.has(session.id)) sessions.set(session.id, session);
  });

  return {
    snapshot: {
      ...account,
      inventory: [...inventory.values()],
      basics: {
        'standard-ice': account.basics['standard-ice'] === 'unknown'
          ? guest.basics['standard-ice']
          : account.basics['standard-ice'],
        'large-ice': account.basics['large-ice'] === 'unknown'
          ? guest.basics['large-ice']
          : account.basics['large-ice'],
      },
      savedRecipes: [...saved.values()],
      shoppingItems: [...shopping.values()],
      tastePreferences: useGuestPreferences ? guest.tastePreferences : account.tastePreferences,
      makeSessions: [...sessions.values()],
      completedGuestImportIds: [...account.completedGuestImportIds, importId],
      hasOnboarded: account.hasOnboarded || guest.hasOnboarded,
    },
    inventoryAdded,
    savedAdded,
    shoppingAdded,
    availabilityConflictCount,
    alreadyImported: false,
  };
}
