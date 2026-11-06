import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';

import { ingredientById, recipeById, recipes } from '@/data/catalog';
import { getRecommendations } from '@/domain/matching';
import {
  createEmptySnapshot,
  LocalAccountRecord,
  mergeGuestIntoAccount,
  normalizePersistedAppData,
  PersistedAppDataV2,
} from '@/domain/persistence';
import { selectQuickRecipe } from '@/domain/quickSelect';
import { getPurchaseSuggestions } from '@/domain/shopping';
import {
  AccountProfile,
  BarSnapshot,
  BasicId,
  FlavourDimension,
  GuestImportState,
  IngredientId,
  MakeSession,
  MatchResult,
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
  undo?: { mode: BarMode; snapshot: BarSnapshot };
}

type SnapshotAction =
  | { type: 'addIngredient'; ingredientId: IngredientId; addedAt: string }
  | { type: 'addStarter'; addedAt: string }
  | { type: 'removeIngredient'; ingredientId: IngredientId }
  | { type: 'setBasic'; basicId: BasicId; value: StapleState }
  | { type: 'setOnboarded'; value: boolean }
  | { type: 'toggleSaved'; recipeId: RecipeId; timestamp: string }
  | { type: 'addShopping'; ingredientId: IngredientId; timestamp: string }
  | { type: 'removeShopping'; ingredientId: IngredientId }
  | { type: 'setPersistentPreference'; dimension: FlavourDimension; value?: TastePreference }
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
    inventory: ['bourbon', 'simple-syrup', 'egg-white', 'lemon-juice'].map((ingredientId) =>
      makeInventoryItem(ingredientId as IngredientId, addedAt),
    ),
    basics: { 'standard-ice': 'available', 'large-ice': 'available' },
    tastePreferences: {
      sour: { intensity: 0.75, importance: 0.7 },
      spiritForward: { intensity: 0.62, importance: 0.45 },
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
    completedGuestImportIds: [...snapshot.completedGuestImportIds],
  };
}

function mutateSnapshot(snapshot: BarSnapshot, action: SnapshotAction): BarSnapshot {
  switch (action.type) {
    case 'addIngredient': {
      const existing = snapshot.inventory.find((item) => item.ingredientId === action.ingredientId);
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
      const starter: IngredientId[] = ['bourbon', 'simple-syrup', 'egg-white'];
      return starter.reduce(
        (next, ingredientId) =>
          mutateSnapshot(next, {
            type: 'addIngredient',
            ingredientId,
            addedAt: action.addedAt,
          }),
        snapshot,
      );
    }
    case 'removeIngredient':
      return {
        ...snapshot,
        inventory: snapshot.inventory.filter((item) => item.ingredientId !== action.ingredientId),
        shoppingItems: snapshot.shoppingItems.map((item) =>
          item.ingredientId === action.ingredientId ? { ...item, ownedAt: undefined } : item,
        ),
      };
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
      const updated = withSnapshot(state, action.mode, after);
      return {
        ...updated,
        notice: action.notice
          ? {
              id: `${Date.now()}-${action.notice}`,
              message: action.notice,
              canUndo: Boolean(action.undoable),
            }
          : state.notice,
        undo: action.undoable ? { mode: action.mode, snapshot: before } : undefined,
      };
    }
    case 'register':
      return {
        ...state,
        account: action.account,
        signedIn: true,
        mode: 'account',
        importState: action.importState,
        notice: {
          id: `${Date.now()}-account`,
          message: 'Guest bar safely copied into your preview account',
          canUndo: false,
        },
      };
    case 'signIn':
      return { ...state, signedIn: true, mode: 'account' };
    case 'signOut':
      return {
        ...state,
        signedIn: false,
        mode: 'guest',
        notice: {
          id: `${Date.now()}-signout`,
          message: 'Signed out; your separate guest bar is still here',
          canUndo: false,
        },
      };
    case 'completeImport':
      return state.account
        ? {
            ...state,
            account: { ...state.account, snapshot: action.snapshot },
            importState: action.importState,
          }
        : state;
    case 'failImport':
      return { ...state, importState: action.importState };
    case 'undo': {
      if (!state.undo) return state;
      const updated = withSnapshot(state, state.undo.mode, state.undo.snapshot);
      return {
        ...updated,
        undo: undefined,
        notice: { id: `${Date.now()}-undo`, message: 'Change undone', canUndo: false },
      };
    }
    case 'clearNotice':
      return { ...state, notice: undefined, undo: undefined };
  }
}

export interface AccountActionResult {
  ok: boolean;
  error?: string;
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
  activateGuest: () => void;
  activateSample: () => void;
  addIngredient: (ingredientId: IngredientId) => void;
  addStarter: () => void;
  removeIngredient: (ingredientId: IngredientId) => void;
  setBasic: (basicId: BasicId, value: StapleState) => void;
  completeOnboarding: () => void;
  toggleSaved: (recipeId: RecipeId) => void;
  addShoppingItem: (ingredientId: IngredientId) => void;
  removeShoppingItem: (ingredientId: IngredientId) => void;
  setPersistentPreference: (dimension: FlavourDimension, value?: TastePreference) => void;
  setSessionPreference: (dimension: FlavourDimension, value?: TastePreference) => void;
  clearSessionPreferences: () => void;
  chooseQuickRecipe: (allowOneAway?: boolean) => MatchResult | undefined;
  startMakeSession: (recipeId: RecipeId, servings: number) => string;
  updateMakeSession: (sessionId: string, patch: Partial<MakeSession>) => void;
  registerAccount: (email: string, password: string) => Promise<AccountActionResult>;
  signIn: (email: string, password: string) => Promise<AccountActionResult>;
  recoverAccount: (email: string) => Promise<AccountActionResult>;
  signOut: () => void;
  retryGuestImport: () => Promise<void>;
  undo: () => void;
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
        if (existing) return existing.id;

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
      registerAccount: async (email, password) => {
        const normalizedEmail = email.trim().toLowerCase();
        if (!validEmail(normalizedEmail)) return { ok: false, error: 'Enter a valid email address.' };
        if (password.length < 8) return { ok: false, error: 'Use at least 8 characters for the password.' };
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
      signIn: async (email, password) => {
        const normalizedEmail = email.trim().toLowerCase();
        if (!validEmail(normalizedEmail) || password.length < 8) {
          return { ok: false, error: 'Check your email and password.' };
        }
        if (!state.account || state.account.profile.email !== normalizedEmail) {
          return { ok: false, error: 'No local preview account matches that email.' };
        }
        dispatch({ type: 'signIn' });
        return { ok: true };
      },
      recoverAccount: async (email) => {
        if (!validEmail(email)) return { ok: false, error: 'Enter a valid email address.' };
        return { ok: true };
      },
      signOut: () => dispatch({ type: 'signOut' }),
      retryGuestImport,
      undo: () => dispatch({ type: 'undo' }),
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
    ],
  );

  return <BarContext.Provider value={value}>{children}</BarContext.Provider>;
}

export function useBar() {
  const context = useContext(BarContext);
  if (!context) throw new Error('useBar must be used within BarProvider');
  return context;
}
