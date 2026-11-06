import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';

import { ingredientById, recipeById, recipes } from '@/data/catalog';
import { verifiedProductById } from '@/data/products';
import { getRecommendations } from '@/domain/matching';
import { patchForRequestedServings } from '@/domain/makeSessions';
import { SAMPLE_INGREDIENT_IDS, STARTER_INGREDIENT_IDS } from '@/domain/onboarding';
import {
  createEmptySnapshot,
  LocalAccountRecord,
  mergeGuestIntoAccount,
  normalizePersistedAppData,
  PersistedAppDataV2,
} from '@/domain/persistence';
import {
  addPrivateProductToSnapshot,
  addVerifiedProductToSnapshot,
  ProductAddStatus,
  ProductOverlapMode,
  VerifiedProductScanMetadata,
  setProductSubmissionProcessingErrorInSnapshot,
  setProductSubmissionStatusInSnapshot,
  submitPrivateProductInSnapshot,
  updatePrivateProductInSnapshot,
} from '@/domain/productInventory';
import { selectQuickRecipe } from '@/domain/quickSelect';
import { getPurchaseSuggestions } from '@/domain/shopping';
import {
  AccountProfile,
  BarSnapshot,
  BasicId,
  ContentRecipeId,
  FlavourDimension,
  GuestImportState,
  IngredientId,
  InventoryItem,
  MakeSession,
  MatchResult,
  MeasurementSystem,
  NewPrivateProductInput,
  PrivateProductUpdateInput,
  ProductSubmissionStatus,
  PurchaseSuggestion,
  RecipeId,
  StapleState,
  TastePreference,
} from '@/domain/types';

const STORAGE_KEY_V2 = 'the-connoisseur.app.v2';
const STORAGE_KEY_V1 = 'the-connoisseur.guest.v1';

export type BarMode = 'guest' | 'sample' | 'account';

interface Notice {
  id: string;
  message: string;
  canUndo: boolean;
}

interface AppState {
  hydration: 'loading' | 'ready' | 'error';
  hydrationError?: string;
  mode: BarMode;
  guest: BarSnapshot;
  sample: BarSnapshot;
  account?: LocalAccountRecord;
  signedIn: boolean;
  importState: GuestImportState;
  notice?: Notice;
  undo?: { mode: BarMode; snapshot: BarSnapshot; expiresAt: number };
}

type SnapshotAction =
  | { type: 'addIngredient'; ingredientId: IngredientId; addedAt: string }
  | { type: 'addStarter'; addedAt: string }
  | { type: 'removeIngredient'; ingredientId: IngredientId }
  | { type: 'removeInventoryItem'; itemId: string }
  | {
      type: 'setInventoryItemStatus';
      itemId: string;
      status: InventoryItem['status'];
      updatedAt: string;
    }
  | {
      type: 'addVerifiedProduct';
      productId: string;
      operationId: string;
      overlapMode: ProductOverlapMode;
      timestamp: string;
      scanMetadata?: VerifiedProductScanMetadata;
    }
  | {
      type: 'addPrivateProduct';
      input: NewPrivateProductInput;
      operationId: string;
      timestamp: string;
    }
  | {
      type: 'submitPrivateProduct';
      privateProductId: string;
      submissionId: string;
      timestamp: string;
    }
  | {
      type: 'updatePrivateProduct';
      privateProductId: string;
      input: PrivateProductUpdateInput;
      timestamp: string;
    }
  | {
      type: 'setProductSubmissionStatus';
      submissionId: string;
      status: ProductSubmissionStatus;
      timestamp: string;
    }
  | {
      type: 'setProductSubmissionError';
      submissionId: string;
      error: string;
      timestamp: string;
    }
  | { type: 'setBasic'; basicId: BasicId; value: StapleState }
  | { type: 'setOnboarded'; value: boolean }
  | { type: 'toggleSaved'; recipeId: ContentRecipeId; timestamp: string }
  | { type: 'addShopping'; ingredientId: IngredientId; timestamp: string }
  | { type: 'removeShopping'; ingredientId: IngredientId }
  | { type: 'setPersistentPreference'; dimension: FlavourDimension; value?: TastePreference }
  | { type: 'setMeasurementSystem'; value: MeasurementSystem }
  | { type: 'setSessionPreference'; dimension: FlavourDimension; value?: TastePreference }
  | { type: 'clearSessionPreferences' }
  | { type: 'recordQuickSelect'; recipeId: RecipeId; timestamp: string }
  | { type: 'addSession'; session: MakeSession }
  | { type: 'patchSession'; sessionId: string; patch: Partial<MakeSession> }
  | { type: 'reset' };

type Action =
  | { type: 'hydrate'; data: PersistedAppDataV2 }
  | { type: 'hydrateError'; message: string }
  | { type: 'setMode'; mode: BarMode }
  | { type: 'mutate'; mode: BarMode; operation: SnapshotAction; notice?: string; undoable?: boolean }
  | {
      type: 'register';
      account: LocalAccountRecord;
      importState: GuestImportState;
    }
  | { type: 'signIn' }
  | { type: 'signOut' }
  | { type: 'completeImport'; snapshot: BarSnapshot; importState: GuestImportState }
  | { type: 'failImport'; importState: GuestImportState }
  | { type: 'undo' }
  | { type: 'expireUndo' }
  | { type: 'clearNotice' };

function makeInventoryItem(ingredientId: IngredientId, addedAt: string) {
  return {
    id: `generic-${ingredientId}`,
    ingredientId,
    status: 'onHand' as const,
    source: 'generic' as const,
    addedAt,
    revision: 1,
  };
}

function sampleSnapshot(): BarSnapshot {
  const addedAt = '2026-01-01T00:00:00.000Z';
  return {
    ...createEmptySnapshot(),
    inventory: SAMPLE_INGREDIENT_IDS.map((ingredientId) => makeInventoryItem(ingredientId, addedAt)),
    basics: { 'standard-ice': 'available', 'large-ice': 'available' },
    tastePreferences: {
      sour: { intensity: 0.85, importance: 0.7 },
      spiritForward: { intensity: 0.55, importance: 0.35 },
    },
    hasOnboarded: true,
  };
}

function cloneSnapshot(snapshot: BarSnapshot): BarSnapshot {
  return {
    ...snapshot,
    inventory: snapshot.inventory.map((item) => ({ ...item })),
    basics: { ...snapshot.basics },
    savedRecipes: snapshot.savedRecipes.map((item) => ({ ...item })),
    shoppingItems: snapshot.shoppingItems.map((item) => ({ ...item })),
    tastePreferences: { ...snapshot.tastePreferences },
    sessionPreferences: {
      ...snapshot.sessionPreferences,
      tastes: { ...snapshot.sessionPreferences.tastes },
      excludedIngredientIds: [...snapshot.sessionPreferences.excludedIngredientIds],
    },
    quickSelectHistory: snapshot.quickSelectHistory.map((item) => ({ ...item })),
    makeSessions: snapshot.makeSessions.map((session) => ({ ...session })),
    privateProducts: snapshot.privateProducts.map((product) => ({ ...product })),
    productSubmissions: snapshot.productSubmissions.map((submission) => ({
      ...submission,
      ...(submission.submittedFields
        ? { submittedFields: { ...submission.submittedFields } }
        : {}),
      ...(submission.extractedFields
        ? { extractedFields: { ...submission.extractedFields } }
        : {}),
    })),
    completedScanOperationIds: [...snapshot.completedScanOperationIds],
    completedGuestImportIds: [...snapshot.completedGuestImportIds],
  };
}

function mutateSnapshot(snapshot: BarSnapshot, action: SnapshotAction): BarSnapshot {
  switch (action.type) {
    case 'addIngredient': {
      const existing = snapshot.inventory.find(
        (item) => item.source === 'generic' && item.ingredientId === action.ingredientId,
      );
      const inventory = existing
        ? snapshot.inventory.map((item) =>
            item.id === existing.id
              ? { ...item, status: 'onHand' as const, revision: item.revision + 1 }
              : item,
          )
        : [...snapshot.inventory, makeInventoryItem(action.ingredientId, action.addedAt)];
      return {
        ...snapshot,
        inventory,
        shoppingItems: snapshot.shoppingItems.map((item) =>
          item.ingredientId === action.ingredientId ? { ...item, ownedAt: action.addedAt } : item,
        ),
      };
    }
    case 'addStarter': {
      return STARTER_INGREDIENT_IDS.reduce(
        (next, ingredientId) =>
          mutateSnapshot(next, {
            type: 'addIngredient',
            ingredientId,
            addedAt: action.addedAt,
          }),
        snapshot,
      );
    }
    case 'removeIngredient': {
      const inventory = snapshot.inventory.filter(
        (item) => !(item.source === 'generic' && item.ingredientId === action.ingredientId),
      );
      const remainsOnHand = inventory.some(
        (item) => item.ingredientId === action.ingredientId && item.status === 'onHand',
      );
      return {
        ...snapshot,
        inventory,
        shoppingItems: snapshot.shoppingItems.map((item) =>
          item.ingredientId === action.ingredientId && !remainsOnHand
            ? { ...item, ownedAt: undefined }
            : item,
        ),
      };
    }
    case 'removeInventoryItem': {
      const removed = snapshot.inventory.find((item) => item.id === action.itemId);
      if (!removed) return snapshot;
      const inventory = snapshot.inventory.filter((item) => item.id !== action.itemId);
      const remainsOnHand = inventory.some(
        (item) => item.ingredientId === removed.ingredientId && item.status === 'onHand',
      );
      return {
        ...snapshot,
        inventory,
        shoppingItems: snapshot.shoppingItems.map((item) =>
          item.ingredientId === removed.ingredientId && !remainsOnHand
            ? { ...item, ownedAt: undefined }
            : item,
        ),
      };
    }
    case 'setInventoryItemStatus': {
      const target = snapshot.inventory.find((item) => item.id === action.itemId);
      if (!target) return snapshot;
      const inventory = snapshot.inventory.map((item) =>
        item.id === action.itemId
          ? { ...item, status: action.status, revision: item.revision + 1 }
          : item,
      );
      const remainsOnHand = inventory.some(
        (item) => item.ingredientId === target.ingredientId && item.status === 'onHand',
      );
      return {
        ...snapshot,
        inventory,
        shoppingItems: snapshot.shoppingItems.map((item) =>
          item.ingredientId === target.ingredientId
            ? {
                ...item,
                ownedAt: remainsOnHand ? item.ownedAt ?? action.updatedAt : undefined,
              }
            : item,
        ),
      };
    }
    case 'addVerifiedProduct': {
      const product = verifiedProductById[action.productId];
      return product
        ? addVerifiedProductToSnapshot(
            snapshot,
            product,
            action.operationId,
            action.overlapMode,
            action.timestamp,
            action.scanMetadata,
          ).snapshot
        : snapshot;
    }
    case 'addPrivateProduct':
      return addPrivateProductToSnapshot(
        snapshot,
        action.input,
        action.operationId,
        action.timestamp,
      ).snapshot;
    case 'submitPrivateProduct':
      return submitPrivateProductInSnapshot(
        snapshot,
        action.privateProductId,
        action.submissionId,
        action.timestamp,
      );
    case 'updatePrivateProduct':
      return updatePrivateProductInSnapshot(
        snapshot,
        action.privateProductId,
        action.input,
        action.timestamp,
      );
    case 'setProductSubmissionStatus':
      return setProductSubmissionStatusInSnapshot(
        snapshot,
        action.submissionId,
        action.status,
        action.timestamp,
      );
    case 'setProductSubmissionError':
      return setProductSubmissionProcessingErrorInSnapshot(
        snapshot,
        action.submissionId,
        action.error,
        action.timestamp,
      );
    case 'setBasic':
      return { ...snapshot, basics: { ...snapshot.basics, [action.basicId]: action.value } };
    case 'setOnboarded':
      return { ...snapshot, hasOnboarded: action.value };
    case 'toggleSaved': {
      const alreadySaved = snapshot.savedRecipes.some((item) => item.recipeId === action.recipeId);
      return {
        ...snapshot,
        savedRecipes: alreadySaved
          ? snapshot.savedRecipes.filter((item) => item.recipeId !== action.recipeId)
          : [...snapshot.savedRecipes, { recipeId: action.recipeId, savedAt: action.timestamp }],
      };
    }
    case 'addShopping': {
      if (snapshot.shoppingItems.some((item) => item.ingredientId === action.ingredientId)) return snapshot;
      const owned = snapshot.inventory.some(
        (item) => item.ingredientId === action.ingredientId && item.status === 'onHand',
      );
      return {
        ...snapshot,
        shoppingItems: [
          ...snapshot.shoppingItems,
          {
            ingredientId: action.ingredientId,
            addedAt: action.timestamp,
            ownedAt: owned ? action.timestamp : undefined,
          },
        ],
      };
    }
    case 'removeShopping':
      return {
        ...snapshot,
        shoppingItems: snapshot.shoppingItems.filter((item) => item.ingredientId !== action.ingredientId),
      };
    case 'setPersistentPreference': {
      const tastePreferences = { ...snapshot.tastePreferences };
      if (action.value) tastePreferences[action.dimension] = action.value;
      else delete tastePreferences[action.dimension];
      return { ...snapshot, tastePreferences };
    }
    case 'setMeasurementSystem':
      return { ...snapshot, measurementSystem: action.value };
    case 'setSessionPreference': {
      const tastes = { ...snapshot.sessionPreferences.tastes };
      if (action.value) tastes[action.dimension] = action.value;
      else delete tastes[action.dimension];
      return {
        ...snapshot,
        sessionPreferences: { ...snapshot.sessionPreferences, tastes },
      };
    }
    case 'clearSessionPreferences':
      return {
        ...snapshot,
        sessionPreferences: {
          ...snapshot.sessionPreferences,
          tastes: {},
          excludedIngredientIds: [],
        },
      };
    case 'recordQuickSelect':
      return {
        ...snapshot,
        quickSelectHistory: [
          ...snapshot.quickSelectHistory,
          { recipeId: action.recipeId, selectedAt: action.timestamp },
        ].slice(-5),
      };
    case 'addSession':
      return { ...snapshot, makeSessions: [...snapshot.makeSessions, action.session] };
    case 'patchSession':
      return {
        ...snapshot,
        makeSessions: snapshot.makeSessions.map((session) =>
          session.id === action.sessionId ? { ...session, ...action.patch } : session,
        ),
      };
    case 'reset':
      return createEmptySnapshot();
  }
}

function snapshotForMode(state: AppState, mode: BarMode): BarSnapshot {
  if (mode === 'sample') return state.sample;
  if (mode === 'account' && state.account) return state.account.snapshot;
  return state.guest;
}

function withSnapshot(state: AppState, mode: BarMode, snapshot: BarSnapshot): AppState {
  if (mode === 'sample') return { ...state, sample: snapshot };
  if (mode === 'account' && state.account) {
    return { ...state, account: { ...state.account, snapshot } };
  }
  return { ...state, guest: snapshot };
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'hydrate':
      return {
        ...state,
        hydration: 'ready',
        guest: action.data.guest,
        account: action.data.account,
        signedIn: action.data.signedIn,
        mode: action.data.signedIn && action.data.account ? 'account' : 'guest',
        importState: action.data.importState,
      };
    case 'hydrateError':
      return {
        ...state,
        hydration: 'ready',
        hydrationError: action.message,
        notice: {
          id: `${Date.now()}-hydrate`,
          message: 'Saved data could not be restored; a fresh local bar is open',
          canUndo: false,
        },
      };
    case 'setMode':
      return {
        ...state,
        mode: action.mode === 'account' && !state.account ? 'guest' : action.mode,
        notice: undefined,
        undo: undefined,
      };
    case 'mutate': {
      const before = cloneSnapshot(snapshotForMode(state, action.mode));
      const after = mutateSnapshot(before, action.operation);
      if (after === before) return state;
      const updated = withSnapshot(state, action.mode, after);
      return {
        ...updated,
        notice: action.notice
          ? {
              id: `${Date.now()}-${action.notice}`,
              message: action.notice,
              canUndo: Boolean(action.undoable),
            }
          : !action.undoable && state.undo?.expiresAt
            ? undefined
            : state.notice,
        undo: action.undoable
          ? { mode: action.mode, snapshot: before, expiresAt: Date.now() + 30_000 }
          : undefined,
      };
    }
    case 'register':
      return {
        ...state,
        account: action.account,
        signedIn: true,
        mode: 'account',
        importState: action.importState,
        undo: undefined,
        notice: {
          id: `${Date.now()}-account`,
          message: 'Guest bar safely copied into your preview account',
          canUndo: false,
        },
      };
    case 'signIn':
      return { ...state, signedIn: true, mode: 'account', undo: undefined };
    case 'signOut':
      return {
        ...state,
        signedIn: false,
        mode: 'guest',
        undo: undefined,
        notice: {
          id: `${Date.now()}-signout`,
          message: 'Preview closed; your separate guest bar is still here',
          canUndo: false,
        },
      };
    case 'completeImport':
      return state.account
        ? {
            ...state,
            account: { ...state.account, snapshot: action.snapshot },
            importState: action.importState,
            undo: undefined,
          }
        : state;
    case 'failImport':
      return { ...state, importState: action.importState, undo: undefined };
    case 'undo': {
      if (!state.undo) return state;
      if (state.undo.expiresAt <= Date.now()) return { ...state, undo: undefined };
      const updated = withSnapshot(state, state.undo.mode, state.undo.snapshot);
      return {
        ...updated,
        undo: undefined,
        notice: { id: `${Date.now()}-undo`, message: 'Change undone', canUndo: false },
      };
    }
    case 'expireUndo':
      return {
        ...state,
        undo: undefined,
        notice: state.notice?.canUndo ? undefined : state.notice,
      };
    case 'clearNotice':
      return { ...state, notice: undefined };
  }
}

export interface AccountActionResult {
  ok: boolean;
  error?: string;
}

export interface ScanAddActionResult {
  status: ProductAddStatus;
  itemId?: string;
  privateProductId?: string;
}

interface BarContextValue {
  hydration: AppState['hydration'];
  hydrationError?: string;
  mode: BarMode;
  snapshot: BarSnapshot;
  recommendations: MatchResult[];
  purchaseSuggestions: PurchaseSuggestion[];
  accountProfile?: AccountProfile;
  importState: GuestImportState;
  notice?: Notice;
  undoExpiresAt?: number;
  activateGuest: () => void;
  activateSample: () => void;
  addIngredient: (ingredientId: IngredientId) => void;
  addStarter: () => void;
  removeIngredient: (ingredientId: IngredientId) => void;
  removeInventoryItem: (itemId: string) => void;
  setInventoryItemStatus: (itemId: string, status: InventoryItem['status']) => void;
  addVerifiedProduct: (
    productId: string,
    operationId: string,
    overlapMode: ProductOverlapMode,
    scanMetadata?: VerifiedProductScanMetadata,
  ) => ScanAddActionResult;
  addPrivateProduct: (
    input: NewPrivateProductInput,
    operationId: string,
  ) => ScanAddActionResult;
  submitPrivateProduct: (privateProductId: string) => string;
  updatePrivateProduct: (privateProductId: string, input: PrivateProductUpdateInput) => void;
  advanceProductSubmission: (submissionId: string, simulateFailure?: boolean) => Promise<void>;
  reviewProductSubmission: (
    submissionId: string,
    status: Extract<ProductSubmissionStatus, 'approved' | 'merged' | 'rejected'>,
  ) => void;
  setBasic: (basicId: BasicId, value: StapleState) => void;
  completeOnboarding: () => void;
  toggleSaved: (recipeId: ContentRecipeId) => void;
  addShoppingItem: (ingredientId: IngredientId) => void;
  removeShoppingItem: (ingredientId: IngredientId) => void;
  setPersistentPreference: (dimension: FlavourDimension, value?: TastePreference) => void;
  setMeasurementSystem: (value: MeasurementSystem) => void;
  setSessionPreference: (dimension: FlavourDimension, value?: TastePreference) => void;
  clearSessionPreferences: () => void;
  chooseQuickRecipe: (allowOneAway?: boolean) => MatchResult | undefined;
  startMakeSession: (recipeId: RecipeId, servings: number) => string;
  updateMakeSession: (sessionId: string, patch: Partial<MakeSession>) => void;
  registerAccount: (email: string) => Promise<AccountActionResult>;
  signIn: (email: string) => Promise<AccountActionResult>;
  recoverAccount: (email: string) => Promise<AccountActionResult>;
  signOut: () => void;
  retryGuestImport: () => Promise<void>;
  undo: () => void;
  expireUndo: () => void;
  clearNotice: () => void;
  resetGuest: () => void;
}

const BarContext = createContext<BarContextValue | null>(null);

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function validEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function BarProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(reducer, {
    hydration: 'loading',
    mode: 'guest',
    guest: createEmptySnapshot(),
    sample: sampleSnapshot(),
    signedIn: false,
    importState: { status: 'idle' },
  });
  const scanOperationResults = useRef(new Map<string, ScanAddActionResult>());

  useEffect(() => {
    let active = true;
    Promise.all([AsyncStorage.getItem(STORAGE_KEY_V2), AsyncStorage.getItem(STORAGE_KEY_V1)])
      .then(([current, legacy]) => {
        if (!active) return;
        const raw = current ?? legacy;
        const parsed: unknown = raw ? JSON.parse(raw) : undefined;
        dispatch({ type: 'hydrate', data: normalizePersistedAppData(parsed) });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : 'Your local bar could not be restored.';
        dispatch({ type: 'hydrateError', message });
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (state.hydration !== 'ready') return;
    const persisted: PersistedAppDataV2 = {
      schemaVersion: 2,
      guest: state.guest,
      account: state.account,
      signedIn: state.signedIn,
      importState: state.importState,
    };
    AsyncStorage.setItem(STORAGE_KEY_V2, JSON.stringify(persisted)).catch(() => {
      // In-memory state remains usable. The account screen explains that this preview is local-only.
    });
  }, [state.account, state.guest, state.hydration, state.importState, state.signedIn]);

  const snapshot = snapshotForMode(state, state.mode);
  const recommendations = useMemo(() => getRecommendations(recipes, snapshot), [snapshot]);
  const purchaseSuggestions = useMemo(() => getPurchaseSuggestions(snapshot), [snapshot]);

  const mutate = useCallback(
    (operation: SnapshotAction, notice?: string, undoable = false) => {
      dispatch({ type: 'mutate', mode: state.mode, operation, notice, undoable });
    },
    [state.mode],
  );

  const retryGuestImport = useCallback(async () => {
    if (!state.account) return;
    const importId = state.importState.importId ?? id('guest-import');
    const startedAt = new Date().toISOString();
    try {
      const report = mergeGuestIntoAccount(state.account.snapshot, state.guest, importId);
      dispatch({
        type: 'completeImport',
        snapshot: report.snapshot,
        importState: {
          importId,
          status: 'confirmed',
          startedAt,
          completedAt: new Date().toISOString(),
          mergedInventoryCount: report.inventoryAdded,
          mergedSavedCount: report.savedAdded,
          mergedShoppingCount: report.shoppingAdded,
          availabilityConflictCount: report.availabilityConflictCount,
        },
      });
    } catch (error: unknown) {
      dispatch({
        type: 'failImport',
        importState: {
          importId,
          status: 'failed',
          startedAt,
          error: error instanceof Error ? error.message : 'The guest import could not be completed.',
        },
      });
    }
  }, [state.account, state.guest, state.importState.importId]);

  const value = useMemo<BarContextValue>(
    () => ({
      hydration: state.hydration,
      hydrationError: state.hydrationError,
      mode: state.mode,
      snapshot,
      recommendations,
      purchaseSuggestions,
      accountProfile: state.signedIn ? state.account?.profile : undefined,
      importState: state.importState,
      notice: state.notice,
      undoExpiresAt: state.undo?.expiresAt,
      activateGuest: () => dispatch({ type: 'setMode', mode: 'guest' }),
      activateSample: () => dispatch({ type: 'setMode', mode: 'sample' }),
      addIngredient: (ingredientId) =>
        mutate(
          { type: 'addIngredient', ingredientId, addedAt: new Date().toISOString() },
          `${ingredientById[ingredientId].shortName} added to your bar`,
          true,
        ),
      addStarter: () =>
        mutate(
          { type: 'addStarter', addedAt: new Date().toISOString() },
          'Classic starter added',
          true,
        ),
      removeIngredient: (ingredientId) =>
        mutate({ type: 'removeIngredient', ingredientId }, 'Ingredient removed', true),
      removeInventoryItem: (itemId) => {
        const item = snapshot.inventory.find((candidate) => candidate.id === itemId);
        mutate(
          { type: 'removeInventoryItem', itemId },
          item ? `${ingredientById[item.ingredientId].shortName} removed` : 'Inventory item removed',
          true,
        );
      },
      setInventoryItemStatus: (itemId, status) => {
        const item = snapshot.inventory.find((candidate) => candidate.id === itemId);
        if (!item) return;
        mutate(
          {
            type: 'setInventoryItemStatus',
            itemId,
            status,
            updatedAt: new Date().toISOString(),
          },
          status === 'onHand'
            ? `${ingredientById[item.ingredientId].shortName} is back on hand`
            : `${ingredientById[item.ingredientId].shortName} marked out of stock`,
          true,
        );
      },
      addVerifiedProduct: (productId, operationId, overlapMode, scanMetadata) => {
        const priorResult = scanOperationResults.current.get(operationId);
        if (priorResult) return priorResult;
        const product = verifiedProductById[productId];
        if (!product) throw new Error('The verified product fixture is unavailable.');
        const timestamp = new Date().toISOString();
        const result = addVerifiedProductToSnapshot(
          snapshot,
          product,
          operationId,
          overlapMode,
          timestamp,
          scanMetadata,
        );
        const message =
          result.status === 'added'
            ? `${product.name} added to your bar`
            : result.status === 'restocked'
              ? `${product.name} is back on hand`
              : result.status === 'duplicate'
                ? `${product.name} is already on hand`
                : 'This scan operation was already completed';
        const publicResult = {
          status: result.status,
          itemId: result.itemId,
        };
        scanOperationResults.current.set(operationId, publicResult);
        if (scanOperationResults.current.size > 100) {
          const oldest = scanOperationResults.current.keys().next().value;
          if (oldest) scanOperationResults.current.delete(oldest);
        }
        mutate(
          { type: 'addVerifiedProduct', productId, operationId, overlapMode, timestamp, scanMetadata },
          message,
          result.status === 'added' || result.status === 'restocked',
        );
        return publicResult;
      },
      addPrivateProduct: (input, operationId) => {
        const priorResult = scanOperationResults.current.get(operationId);
        if (priorResult) return priorResult;
        const timestamp = new Date().toISOString();
        const result = addPrivateProductToSnapshot(snapshot, input, operationId, timestamp);
        const message =
          result.status === 'added'
            ? `${input.name} saved privately in your bar`
            : result.status === 'restocked'
              ? `${input.name} is back on hand`
              : result.status === 'duplicate'
                ? `${input.name} is already on hand`
                : 'This scan operation was already completed';
        const publicResult = {
          status: result.status,
          itemId: result.itemId,
          privateProductId: result.privateProductId,
        };
        scanOperationResults.current.set(operationId, publicResult);
        if (scanOperationResults.current.size > 100) {
          const oldest = scanOperationResults.current.keys().next().value;
          if (oldest) scanOperationResults.current.delete(oldest);
        }
        mutate(
          { type: 'addPrivateProduct', input, operationId, timestamp },
          message,
          result.status === 'added' || result.status === 'restocked',
        );
        return publicResult;
      },
      submitPrivateProduct: (privateProductId) => {
        const product = snapshot.privateProducts.find((item) => item.id === privateProductId);
        if (!product) throw new Error('The private bottle is no longer available. Save it again before sharing.');
        const existing = snapshot.productSubmissions.find(
          (submission) => submission.privateProductId === privateProductId,
        );
        if (existing && existing.status !== 'draft') return existing.id;
        const submissionId = existing?.id ?? id('submission');
        mutate(
          {
            type: 'submitPrivateProduct',
            privateProductId,
            submissionId,
            timestamp: new Date().toISOString(),
          },
          'Private bottle opted into local catalogue-review simulation',
        );
        return submissionId;
      },
      updatePrivateProduct: (privateProductId, input) =>
        mutate(
          {
            type: 'updatePrivateProduct',
            privateProductId,
            input,
            timestamp: new Date().toISOString(),
          },
          `${input.name.trim()} updated privately`,
          true,
        ),
      advanceProductSubmission: async (submissionId, simulateFailure = false) => {
        mutate({
          type: 'setProductSubmissionStatus',
          submissionId,
          status: 'processing',
          timestamp: new Date().toISOString(),
        });
        await new Promise<void>((resolve) => setTimeout(resolve, 650));
        if (simulateFailure) {
          const error = 'Simulated extraction failed. Your private bottle is still saved and usable.';
          mutate(
            {
              type: 'setProductSubmissionError',
              submissionId,
              error,
              timestamp: new Date().toISOString(),
            },
            'Simulated extraction paused; retry when ready',
          );
          throw new Error(error);
        }
        mutate(
          {
            type: 'setProductSubmissionStatus',
            submissionId,
            status: 'pending_review',
            timestamp: new Date().toISOString(),
          },
          'Simulated extraction complete; catalogue review is pending',
        );
      },
      reviewProductSubmission: (submissionId, status) =>
        mutate(
          {
            type: 'setProductSubmissionStatus',
            submissionId,
            status,
            timestamp: new Date().toISOString(),
          },
          `Local review marked ${status.replace('_', ' ')}`,
        ),
      setBasic: (basicId, basicState) =>
        mutate(
          { type: 'setBasic', basicId, value: basicState },
          `${ingredientById[basicId].shortName} updated`,
          true,
        ),
      completeOnboarding: () => mutate({ type: 'setOnboarded', value: true }),
      toggleSaved: (recipeId) =>
        mutate({ type: 'toggleSaved', recipeId, timestamp: new Date().toISOString() }),
      addShoppingItem: (ingredientId) =>
        mutate(
          { type: 'addShopping', ingredientId, timestamp: new Date().toISOString() },
          `${ingredientById[ingredientId].shortName} added to shopping`,
        ),
      removeShoppingItem: (ingredientId) =>
        mutate({ type: 'removeShopping', ingredientId }, 'Shopping item removed'),
      setPersistentPreference: (dimension, preference) =>
        mutate({ type: 'setPersistentPreference', dimension, value: preference }),
      setMeasurementSystem: (measurementSystem) =>
        mutate({ type: 'setMeasurementSystem', value: measurementSystem }),
      setSessionPreference: (dimension, preference) =>
        mutate({ type: 'setSessionPreference', dimension, value: preference }),
      clearSessionPreferences: () => mutate({ type: 'clearSessionPreferences' }),
      chooseQuickRecipe: (allowOneAway = false) => {
        const selected = selectQuickRecipe(recommendations, snapshot.quickSelectHistory, {
          allowOneAway,
        });
        if (selected) {
          mutate({
            type: 'recordQuickSelect',
            recipeId: selected.recipe.id,
            timestamp: new Date().toISOString(),
          });
        }
        return selected;
      },
      startMakeSession: (recipeId, servings) => {
        const recipe = recipeById[recipeId];
        const existing = snapshot.makeSessions.find(
          (session) =>
            session.recipeId === recipeId &&
            session.recipeVersionId === recipe.versionId &&
            !session.completedAt,
        );
        if (existing) {
          const timestamp = new Date().toISOString();
          const patch = patchForRequestedServings(existing, servings, timestamp);
          if (patch) mutate({ type: 'patchSession', sessionId: existing.id, patch });
          return existing.id;
        }

        const timestamp = new Date().toISOString();
        const session: MakeSession = {
          id: id('make'),
          recipeId,
          recipeVersionId: recipe.versionId,
          servings,
          stepIndex: -1,
          startedAt: timestamp,
          updatedAt: timestamp,
        };
        mutate({ type: 'addSession', session });
        return session.id;
      },
      updateMakeSession: (sessionId, patch) =>
        mutate({
          type: 'patchSession',
          sessionId,
          patch: { ...patch, updatedAt: new Date().toISOString() },
        }),
      registerAccount: async (email) => {
        const normalizedEmail = email.trim().toLowerCase();
        if (!validEmail(normalizedEmail)) return { ok: false, error: 'Enter a valid email address.' };
        const timestamp = new Date().toISOString();
        const samePreviewAccount = state.account?.profile.email === normalizedEmail;
        const profile: AccountProfile = samePreviewAccount
          ? state.account!.profile
          : { id: id('account'), email: normalizedEmail, createdAt: timestamp };
        const importId = state.importState.importId ?? id('guest-import');
        const report = mergeGuestIntoAccount(
          samePreviewAccount ? state.account!.snapshot : createEmptySnapshot(),
          state.guest,
          importId,
          false,
        );
        dispatch({
          type: 'register',
          account: { profile, snapshot: report.snapshot },
          importState: {
            importId,
            status: 'confirmed',
            startedAt: timestamp,
            completedAt: new Date().toISOString(),
            mergedInventoryCount: report.inventoryAdded,
            mergedSavedCount: report.savedAdded,
            mergedShoppingCount: report.shoppingAdded,
            availabilityConflictCount: report.availabilityConflictCount,
          },
        });
        return { ok: true };
      },
      signIn: async (email) => {
        const normalizedEmail = email.trim().toLowerCase();
        if (!validEmail(normalizedEmail)) {
          return { ok: false, error: 'Enter a valid email address.' };
        }
        if (!state.account || state.account.profile.email !== normalizedEmail) {
          return { ok: false, error: 'No local preview account matches that email.' };
        }
        dispatch({ type: 'signIn' });
        return { ok: true };
      },
      recoverAccount: async (email) => {
        const normalizedEmail = email.trim().toLowerCase();
        if (!validEmail(normalizedEmail)) return { ok: false, error: 'Enter a valid email address.' };
        if (!state.account || state.account.profile.email !== normalizedEmail) {
          return { ok: false, error: 'No local preview account matches that email.' };
        }
        return { ok: true };
      },
      signOut: () => dispatch({ type: 'signOut' }),
      retryGuestImport,
      undo: () => dispatch({ type: 'undo' }),
      expireUndo: () => dispatch({ type: 'expireUndo' }),
      clearNotice: () => dispatch({ type: 'clearNotice' }),
      resetGuest: () =>
        dispatch({ type: 'mutate', mode: 'guest', operation: { type: 'reset' } }),
    }),
    [
      mutate,
      purchaseSuggestions,
      recommendations,
      retryGuestImport,
      snapshot,
      state.account,
      state.guest,
      state.hydration,
      state.hydrationError,
      state.importState,
      state.mode,
      state.notice,
      state.signedIn,
      state.undo,
    ],
  );

  return <BarContext.Provider value={value}>{children}</BarContext.Provider>;
}

export function useBar() {
  const context = useContext(BarContext);
  if (!context) throw new Error('useBar must be used within BarProvider');
  return context;
}
