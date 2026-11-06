import {
  AccountProfile,
  BarSnapshot,
  BasicId,
  ContentRecipeId,
  GuestImportState,
  IngredientId,
  InventoryItem,
  MakeSession,
  PrivateProduct,
  ProductSubmission,
  ProductSubmissionStatus,
  RecipeId,
  SavedRecipe,
  ShoppingItem,
  StapleState,
  TastePreferences,
} from '@/domain/types';
import { normalizeBarcode } from '@/domain/barcode';
import { recipeById } from '@/data/catalog';
import { verifiedProductById } from '@/data/products';

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
  'vodka',
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

const recipeIds = new Set<RecipeId>(['whiskey-sour', 'old-fashioned', 'bourbon-smash', 'vodka-sour']);
const contentRecipeIds = new Set<ContentRecipeId>([...recipeIds, 'classic-martini']);

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
    measurementSystem: 'metric',
    tastePreferences: {},
    sessionPreferences: { tastes: {}, excludedIngredientIds: [] },
    quickSelectHistory: [],
    makeSessions: [],
    privateProducts: [],
    productSubmissions: [],
    completedScanOperationIds: [],
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
    const productId = typeof item.productId === 'string' && item.productId.trim() ? item.productId : undefined;
    const privateProductId =
      !productId && typeof item.privateProductId === 'string' && item.privateProductId.trim()
        ? item.privateProductId
        : undefined;
    const source = item.source === 'product' || productId || privateProductId ? 'product' : 'generic';
    if (source === 'product' && !productId && !privateProductId) return;
    const scanNormalization =
      source === 'product' && typeof item.scannedBarcodeOriginal === 'string'
        ? normalizeBarcode(item.scannedBarcodeOriginal)
        : undefined;
    const hasValidScanMetadata = Boolean(
      scanNormalization?.ok &&
      (item.scannedBarcodeSymbology === 'ean13' || item.scannedBarcodeSymbology === 'upca') &&
      scanNormalization.symbology === item.scannedBarcodeSymbology &&
      (!productId || !verifiedProductById[productId] || scanNormalization.canonicalBarcode === verifiedProductById[productId].barcode),
    );
    const normalized: InventoryItem = {
      id: typeof item.id === 'string' ? item.id : `generic-${ingredientId}-${index}`,
      ingredientId: ingredientId as IngredientId,
      status: item.status === 'outOfStock' ? 'outOfStock' : 'onHand',
      source,
      ...(productId ? { productId } : {}),
      ...(privateProductId ? { privateProductId } : {}),
      ...(hasValidScanMetadata
        ? {
            scannedBarcodeOriginal: item.scannedBarcodeOriginal as string,
            scannedBarcodeSymbology: item.scannedBarcodeSymbology as InventoryItem['scannedBarcodeSymbology'],
          }
        : {}),
      addedAt: typeof item.addedAt === 'string' ? item.addedAt : new Date(0).toISOString(),
      revision:
        typeof item.revision === 'number' && Number.isFinite(item.revision)
          ? Math.max(1, Math.trunc(item.revision))
          : 1,
    };
    const key =
      normalized.source === 'generic'
        ? `generic:${normalized.ingredientId}`
        : `product:${normalized.productId ?? normalized.privateProductId ?? normalized.id}`;
    byKey.set(key, normalized);
  });
  return [...byKey.values()];
}

function normalizeSaved(value: unknown, legacyIds: unknown): SavedRecipe[] {
  const normalized = new Map<ContentRecipeId, SavedRecipe>();
  if (Array.isArray(value)) {
    value.forEach((raw) => {
      const item = record(raw);
      if (typeof item.recipeId !== 'string' || !contentRecipeIds.has(item.recipeId as ContentRecipeId)) return;
      normalized.set(item.recipeId as ContentRecipeId, {
        recipeId: item.recipeId as ContentRecipeId,
        savedAt: typeof item.savedAt === 'string' ? item.savedAt : new Date(0).toISOString(),
      });
    });
  }
  if (Array.isArray(legacyIds)) {
    legacyIds.forEach((id) => {
      if (typeof id === 'string' && contentRecipeIds.has(id as ContentRecipeId) && !normalized.has(id as ContentRecipeId)) {
        normalized.set(id as ContentRecipeId, { recipeId: id as ContentRecipeId, savedAt: new Date(0).toISOString() });
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

function validDate(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function normalizePrivateProducts(value: unknown): PrivateProduct[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map<string, PrivateProduct>();
  value.forEach((raw) => {
    const item = record(raw);
    if (typeof item.id !== 'string' || !item.id.trim()) return;
    if (typeof item.barcode !== 'string') return;
    if (typeof item.originalBarcode !== 'string' || !item.originalBarcode.trim()) return;
    if (item.symbology !== 'ean13' && item.symbology !== 'upca') return;
    const normalizedBarcode = normalizeBarcode(item.originalBarcode);
    if (
      !normalizedBarcode.ok ||
      normalizedBarcode.canonicalBarcode !== item.barcode ||
      normalizedBarcode.symbology !== item.symbology
    ) return;
    if (typeof item.name !== 'string' || !item.name.trim()) return;
    if (typeof item.ingredientId !== 'string' || !ingredientIds.has(item.ingredientId as IngredientId)) return;
    if (!validDate(item.createdAt)) return;

    const normalized: PrivateProduct = {
      id: item.id,
      barcode: item.barcode,
      originalBarcode: item.originalBarcode,
      symbology: item.symbology,
      name: item.name.trim(),
      ...(typeof item.brand === 'string' && item.brand.trim() ? { brand: item.brand.trim() } : {}),
      ingredientId: item.ingredientId as IngredientId,
      ...(typeof item.bottleSizeMl === 'number' && Number.isFinite(item.bottleSizeMl)
        ? { bottleSizeMl: Math.max(1, Math.round(item.bottleSizeMl)) }
        : {}),
      ...(typeof item.labelPhotoUri === 'string' && item.labelPhotoUri.trim()
        ? { labelPhotoUri: item.labelPhotoUri }
        : {}),
      createdAt: item.createdAt,
      updatedAt: validDate(item.updatedAt) ? item.updatedAt : item.createdAt,
    };
    byId.set(normalized.id, normalized);
  });
  return [...byId.values()];
}

const submissionStatuses = new Set<ProductSubmissionStatus>([
  'draft',
  'submitted',
  'processing',
  'pending_review',
  'approved',
  'merged',
  'rejected',
]);

function normalizeProductSubmissions(
  value: unknown,
  privateProductIds: Set<string>,
  privateProductIdRemap: Map<string, string>,
): ProductSubmission[] {
  if (!Array.isArray(value)) return [];
  const byPrivateProductId = new Map<string, ProductSubmission>();
  const usedIds = new Set<string>();
  value.forEach((raw) => {
    const item = record(raw);
    if (typeof item.id !== 'string' || !item.id.trim()) return;
    if (usedIds.has(item.id) || typeof item.privateProductId !== 'string') return;
    const privateProductId = privateProductIdRemap.get(item.privateProductId) ?? item.privateProductId;
    if (!privateProductIds.has(privateProductId)) return;
    if (typeof item.status !== 'string' || !submissionStatuses.has(item.status as ProductSubmissionStatus)) return;
    if (!validDate(item.createdAt)) return;
    if (item.status !== 'draft' && item.shareConsent !== true) return;

    const submitted = record(item.submittedFields);
    const submittedFields: ProductSubmission['submittedFields'] =
      typeof submitted.name === 'string' && submitted.name.trim() &&
      typeof submitted.ingredientId === 'string' && ingredientIds.has(submitted.ingredientId as IngredientId)
        ? {
            name: submitted.name.trim(),
            ...(typeof submitted.brand === 'string' && submitted.brand.trim()
              ? { brand: submitted.brand.trim() }
              : {}),
            ingredientId: submitted.ingredientId as IngredientId,
            ...(typeof submitted.bottleSizeMl === 'number' && Number.isFinite(submitted.bottleSizeMl)
              ? { bottleSizeMl: Math.max(1, Math.round(submitted.bottleSizeMl)) }
              : {}),
          }
        : undefined;
    const extracted = record(item.extractedFields);
    const extractedFields: ProductSubmission['extractedFields'] = {};
    if (typeof extracted.name === 'string' && extracted.name.trim()) extractedFields.name = extracted.name.trim();
    if (typeof extracted.brand === 'string' && extracted.brand.trim()) extractedFields.brand = extracted.brand.trim();
    if (typeof extracted.ingredientId === 'string' && ingredientIds.has(extracted.ingredientId as IngredientId)) {
      extractedFields.ingredientId = extracted.ingredientId as IngredientId;
    }
    if (typeof extracted.bottleSizeMl === 'number' && Number.isFinite(extracted.bottleSizeMl)) {
      extractedFields.bottleSizeMl = Math.max(1, Math.round(extracted.bottleSizeMl));
    }

    const normalized: ProductSubmission = {
      id: item.id,
      privateProductId,
      status: item.status as ProductSubmissionStatus,
      shareConsent: item.status === 'draft' ? false : true,
      createdAt: item.createdAt,
      updatedAt: validDate(item.updatedAt) ? item.updatedAt : item.createdAt,
      ...(submittedFields ? { submittedFields } : {}),
      ...(Object.keys(extractedFields).length ? { extractedFields } : {}),
      ...(typeof item.sourcePhotoUri === 'string' && item.sourcePhotoUri.trim()
        ? { sourcePhotoUri: item.sourcePhotoUri }
        : {}),
      ...(typeof item.modelId === 'string' && item.modelId.trim() ? { modelId: item.modelId } : {}),
      ...(typeof item.processingError === 'string' && item.processingError.trim()
        ? { processingError: item.processingError }
        : {}),
    };
    const existing = byPrivateProductId.get(privateProductId);
    if (!existing || Date.parse(normalized.updatedAt) >= Date.parse(existing.updatedAt)) {
      if (existing) usedIds.delete(existing.id);
      byPrivateProductId.set(privateProductId, normalized);
      usedIds.add(normalized.id);
    }
  });
  return [...byPrivateProductId.values()];
}

function normalizeMakeSessions(value: unknown): MakeSession[] {
  if (!Array.isArray(value)) return [];

  const byId = new Map<string, MakeSession>();
  value.forEach((raw) => {
    const session = record(raw);
    if (typeof session.id !== 'string' || session.id.trim().length === 0) return;
    if (typeof session.recipeId !== 'string' || !recipeIds.has(session.recipeId as RecipeId)) return;

    const recipeId = session.recipeId as RecipeId;
    const recipe = recipeById[recipeId];
    if (!recipe || session.recipeVersionId !== recipe.versionId || !validDate(session.startedAt)) return;

    const rawStepIndex =
      typeof session.stepIndex === 'number' && Number.isFinite(session.stepIndex)
        ? Math.trunc(session.stepIndex)
        : -1;
    const stepIndex = Math.max(-1, Math.min(recipe.steps.length - 1, rawStepIndex));
    const rawServings =
      typeof session.servings === 'number' && Number.isFinite(session.servings)
        ? Math.trunc(session.servings)
        : recipe.baseServings;
    const servings = Math.max(1, Math.min(8, rawServings));
    const completedAt = validDate(session.completedAt) ? session.completedAt : undefined;
    const updatedAt = validDate(session.updatedAt) ? session.updatedAt : session.startedAt;
    const feedback =
      completedAt && (session.feedback === 'liked' || session.feedback === 'notForMe')
        ? session.feedback
        : undefined;
    const feedbackNote =
      completedAt && typeof session.feedbackNote === 'string'
        ? session.feedbackNote.trim().slice(0, 500) || undefined
        : undefined;

    const currentStep = stepIndex >= 0 ? recipe.steps[stepIndex] : undefined;
    const hasValidTimer =
      !completedAt &&
      validDate(session.timerTarget) &&
      typeof session.timerStepId === 'string' &&
      currentStep?.id === session.timerStepId &&
      typeof currentStep.timerSeconds === 'number';

    byId.set(session.id, {
      id: session.id,
      recipeId,
      recipeVersionId: recipe.versionId,
      servings,
      stepIndex,
      ...(hasValidTimer
        ? { timerTarget: session.timerTarget as string, timerStepId: session.timerStepId as string }
        : {}),
      ...(completedAt ? { completedAt } : {}),
      ...(feedback ? { feedback } : {}),
      ...(feedbackNote ? { feedbackNote } : {}),
      startedAt: session.startedAt,
      updatedAt,
    });
  });

  return [...byId.values()];
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
  const privateProductByBarcode = new Map<string, PrivateProduct>();
  const privateProductIdRemap = new Map<string, string>();
  normalizePrivateProducts(source.privateProducts).forEach((product) => {
    const existing = privateProductByBarcode.get(product.barcode);
    if (existing) {
      privateProductIdRemap.set(product.id, existing.id);
    } else {
      privateProductByBarcode.set(product.barcode, product);
      privateProductIdRemap.set(product.id, product.id);
    }
  });
  const privateProducts = [...privateProductByBarcode.values()];
  const privateProductById = new Map(privateProducts.map((product) => [product.id, product]));
  const privateProductIds = new Set(privateProducts.map((product) => product.id));
  const inventoryByKey = new Map<string, InventoryItem>();
  normalizeInventory(source.inventory)
    .map((item) => {
      if (!item.privateProductId) return item;
      const privateProductId = privateProductIdRemap.get(item.privateProductId) ?? item.privateProductId;
      const canonicalProduct = privateProductById.get(privateProductId);
      return {
        ...item,
        privateProductId,
        ...(canonicalProduct ? { ingredientId: canonicalProduct.ingredientId } : {}),
      };
    })
    .filter((item) => !item.privateProductId || privateProductIds.has(item.privateProductId))
    .forEach((item) => {
      const key = item.source === 'generic'
        ? `generic:${item.ingredientId}`
        : `product:${item.productId ?? item.privateProductId ?? item.id}`;
      inventoryByKey.set(key, item);
    });
  const inventory = [...inventoryByKey.values()];

  return {
    ...createEmptySnapshot(),
    inventory,
    basics,
    savedRecipes: normalizeSaved(source.savedRecipes, source.savedRecipeIds),
    shoppingItems: normalizeShopping(source.shoppingItems),
    measurementSystem: source.measurementSystem === 'us' ? 'us' : 'metric',
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
    makeSessions: normalizeMakeSessions(source.makeSessions),
    privateProducts,
    productSubmissions: normalizeProductSubmissions(
      source.productSubmissions,
      privateProductIds,
      privateProductIdRemap,
    ),
    completedScanOperationIds: Array.isArray(source.completedScanOperationIds)
      ? [...new Set(source.completedScanOperationIds.filter((id): id is string => typeof id === 'string' && Boolean(id.trim())))]
          .slice(-100)
      : [],
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

  const privateProducts = new Map(account.privateProducts.map((product) => [product.id, product]));
  const privateProductIdByBarcode = new Map(
    account.privateProducts.map((product) => [product.barcode, product.id]),
  );
  const guestPrivateProductIdRemap = new Map<string, string>();
  guest.privateProducts.forEach((product, index) => {
    const existingId = privateProductIdByBarcode.get(product.barcode);
    if (existingId) {
      guestPrivateProductIdRemap.set(product.id, existingId);
      return;
    }
    let canonicalId = product.id;
    let collisionIndex = index;
    while (privateProducts.has(canonicalId)) {
      canonicalId = `${product.id}-guest-${collisionIndex}`;
      collisionIndex += 1;
    }
    const canonicalProduct = canonicalId === product.id ? product : { ...product, id: canonicalId };
    privateProducts.set(canonicalId, canonicalProduct);
    privateProductIdByBarcode.set(product.barcode, canonicalId);
    guestPrivateProductIdRemap.set(product.id, canonicalId);
  });

  const inventoryKey = (item: InventoryItem) =>
    item.source === 'generic'
      ? `generic:${item.ingredientId}`
      : `product:${item.productId ?? item.privateProductId ?? item.id}`;
  const inventory = new Map(account.inventory.map((item) => [inventoryKey(item), item]));
  let availabilityConflictCount = 0;
  let inventoryAdded = 0;
  guest.inventory.forEach((rawItem) => {
    const privateProductId = rawItem.privateProductId
      ? guestPrivateProductIdRemap.get(rawItem.privateProductId) ?? rawItem.privateProductId
      : undefined;
    const canonicalPrivateProduct = privateProductId ? privateProducts.get(privateProductId) : undefined;
    const item = privateProductId
      ? {
          ...rawItem,
          privateProductId,
          ...(canonicalPrivateProduct
            ? { ingredientId: canonicalPrivateProduct.ingredientId }
            : {}),
        }
      : rawItem;
    const key = inventoryKey(item);
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

  const productSubmissions = new Map(
    account.productSubmissions.map((submission) => [submission.privateProductId, submission]),
  );
  const submissionRank: Record<ProductSubmissionStatus, number> = {
    draft: 0,
    submitted: 1,
    processing: 2,
    pending_review: 3,
    approved: 4,
    merged: 4,
    rejected: 4,
  };
  const usedSubmissionIds = new Set(account.productSubmissions.map((submission) => submission.id));
  guest.productSubmissions.forEach((submission) => {
    const privateProductId =
      guestPrivateProductIdRemap.get(submission.privateProductId) ?? submission.privateProductId;
    const existing = productSubmissions.get(privateProductId);
    const shouldReplace = !existing ||
      submissionRank[submission.status] > submissionRank[existing.status] ||
      (
        submissionRank[submission.status] === submissionRank[existing.status] &&
        Date.parse(submission.updatedAt) > Date.parse(existing.updatedAt)
      );
    if (!shouldReplace) return;
    if (existing) usedSubmissionIds.delete(existing.id);
    let submissionId = submission.id;
    let collisionIndex = 1;
    while (usedSubmissionIds.has(submissionId)) {
      submissionId = `${submission.id}-guest-${collisionIndex}`;
      collisionIndex += 1;
    }
    productSubmissions.set(privateProductId, {
      ...submission,
      id: submissionId,
      privateProductId,
    });
    usedSubmissionIds.add(submissionId);
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
      privateProducts: [...privateProducts.values()],
      productSubmissions: [...productSubmissions.values()],
      completedScanOperationIds: [
        ...new Set([...account.completedScanOperationIds, ...guest.completedScanOperationIds]),
      ].slice(-100),
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
