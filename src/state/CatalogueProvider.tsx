import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import type { CatalogueIngredient, CatalogueRecipe, CatalogueRecipeIngredient } from '@/catalogue/types';

const STORAGE_KEY = 'the-connoisseur.catalogue-user-state.v1';

export interface CatalogueBarItem {
  ingredientId: number;
  name: string;
  fullName?: string;
  hierarchy?: string[];
  percentAbv?: number;
  status: 'onHand' | 'outOfStock';
  addedAt: string;
}

export interface CatalogueMakeSession {
  id: string;
  recipe: CatalogueRecipe;
  stepIndex: -1 | 0;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface CatalogueUserState {
  schemaVersion: 1;
  inventory: CatalogueBarItem[];
  makeSessions: CatalogueMakeSession[];
}

interface CatalogueContextValue {
  hydrated: boolean;
  persistenceError?: string;
  inventory: CatalogueBarItem[];
  makeSessions: CatalogueMakeSession[];
  addIngredient: (ingredient: CatalogueIngredient | CatalogueRecipeIngredient) => void;
  addRecipeIngredients: (recipe: CatalogueRecipe) => void;
  removeIngredient: (ingredientId: number) => void;
  setIngredientStatus: (ingredientId: number, status: CatalogueBarItem['status']) => void;
  startMakeSession: (recipe: CatalogueRecipe) => string;
  updateMakeSession: (sessionId: string, patch: Partial<Pick<CatalogueMakeSession, 'stepIndex' | 'completedAt'>>) => void;
}

const EMPTY_STATE: CatalogueUserState = { schemaVersion: 1, inventory: [], makeSessions: [] };
const CatalogueContext = createContext<CatalogueContextValue | undefined>(undefined);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeState(value: unknown): CatalogueUserState {
  if (!isRecord(value)) return EMPTY_STATE;
  const inventory = Array.isArray(value.inventory)
    ? value.inventory.flatMap((raw): CatalogueBarItem[] => {
        if (!isRecord(raw) || !Number.isInteger(raw.ingredientId) || (raw.ingredientId as number) <= 0) return [];
        if (typeof raw.name !== 'string' || !raw.name.trim()) return [];
        return [{
          ingredientId: raw.ingredientId as number,
          name: raw.name.trim(),
          ...(typeof raw.fullName === 'string' && raw.fullName.trim() ? { fullName: raw.fullName.trim() } : {}),
          ...(Array.isArray(raw.hierarchy)
            ? { hierarchy: raw.hierarchy.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) }
            : {}),
          ...(typeof raw.percentAbv === 'number' && Number.isFinite(raw.percentAbv) ? { percentAbv: raw.percentAbv } : {}),
          status: raw.status === 'outOfStock' ? 'outOfStock' : 'onHand',
          addedAt: typeof raw.addedAt === 'string' ? raw.addedAt : new Date(0).toISOString(),
        }];
      })
    : [];
  const makeSessions = Array.isArray(value.makeSessions)
    ? value.makeSessions.flatMap((raw): CatalogueMakeSession[] => {
        if (!isRecord(raw) || typeof raw.id !== 'string' || !isRecord(raw.recipe)) return [];
        const recipe = raw.recipe as unknown as CatalogueRecipe;
        if (!Number.isInteger(recipe.id) || typeof recipe.name !== 'string' || !Array.isArray(recipe.ingredients)) return [];
        return [{
          id: raw.id,
          recipe,
          stepIndex: raw.stepIndex === 0 ? 0 : -1,
          startedAt: typeof raw.startedAt === 'string' ? raw.startedAt : new Date(0).toISOString(),
          updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date(0).toISOString(),
          ...(typeof raw.completedAt === 'string' ? { completedAt: raw.completedAt } : {}),
        }];
      })
    : [];
  return { schemaVersion: 1, inventory, makeSessions };
}

function mergeHydratedState(stored: CatalogueUserState, current: CatalogueUserState): CatalogueUserState {
  const inventory = new Map(stored.inventory.map((item) => [item.ingredientId, item]));
  current.inventory.forEach((item) => inventory.set(item.ingredientId, item));
  const makeSessions = new Map(stored.makeSessions.map((session) => [session.id, session]));
  current.makeSessions.forEach((session) => makeSessions.set(session.id, session));
  return {
    schemaVersion: 1,
    inventory: [...inventory.values()],
    makeSessions: [...makeSessions.values()],
  };
}

function toBarItem(ingredient: CatalogueIngredient | CatalogueRecipeIngredient): CatalogueBarItem {
  const fromRecipe = 'ingredientName' in ingredient;
  const recipeIngredient = fromRecipe ? ingredient : undefined;
  const catalogueIngredient = fromRecipe ? undefined : ingredient;
  return {
    ingredientId: recipeIngredient?.ingredientId ?? catalogueIngredient!.id,
    name: recipeIngredient?.ingredientName ?? catalogueIngredient!.name,
    ...(recipeIngredient?.fullName ? { fullName: recipeIngredient.fullName } : {}),
    ...(recipeIngredient?.hierarchy ? { hierarchy: recipeIngredient.hierarchy } : {}),
    ...(catalogueIngredient?.percentAbv !== undefined ? { percentAbv: catalogueIngredient.percentAbv } : {}),
    status: 'onHand',
    addedAt: new Date().toISOString(),
  };
}

export function CatalogueProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<CatalogueUserState>(EMPTY_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [persistenceError, setPersistenceError] = useState<string>();

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (active) {
        const hydratedState = stored ? normalizeState(JSON.parse(stored) as unknown) : EMPTY_STATE;
        setState((current) => mergeHydratedState(hydratedState, current));
      }
    }).catch(() => {
      if (active) setState(EMPTY_STATE);
    }).finally(() => {
      if (active) setHydrated(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      .then(() => setPersistenceError(undefined))
      .catch(() => setPersistenceError('External catalogue inventory and Make progress could not be saved on this device.'));
  }, [hydrated, state]);

  const addIngredient = useCallback((ingredient: CatalogueIngredient | CatalogueRecipeIngredient) => {
    const next = toBarItem(ingredient);
    setState((current) => ({
      ...current,
      inventory: current.inventory.some((item) => item.ingredientId === next.ingredientId)
        ? current.inventory.map((item) => item.ingredientId === next.ingredientId ? { ...item, ...next, addedAt: item.addedAt } : item)
        : [...current.inventory, next],
    }));
  }, []);

  const addRecipeIngredients = useCallback((recipe: CatalogueRecipe) => {
    const items = recipe.ingredients.map(toBarItem);
    setState((current) => {
      const byId = new Map(current.inventory.map((item) => [item.ingredientId, item]));
      items.forEach((item) => {
        byId.set(item.ingredientId, { ...item, addedAt: byId.get(item.ingredientId)?.addedAt ?? item.addedAt });
      });
      return { ...current, inventory: [...byId.values()] };
    });
  }, []);

  const removeIngredient = useCallback((ingredientId: number) => {
    setState((current) => ({ ...current, inventory: current.inventory.filter((item) => item.ingredientId !== ingredientId) }));
  }, []);

  const setIngredientStatus = useCallback((ingredientId: number, status: CatalogueBarItem['status']) => {
    setState((current) => ({
      ...current,
      inventory: current.inventory.map((item) => item.ingredientId === ingredientId ? { ...item, status } : item),
    }));
  }, []);

  const startMakeSession = useCallback((recipe: CatalogueRecipe) => {
    const existing = state.makeSessions.find((session) => session.recipe.id === recipe.id && !session.completedAt);
    if (existing) return existing.id;
    const timestamp = new Date().toISOString();
    const session: CatalogueMakeSession = {
      id: `catalogue-make-${recipe.id}-${Date.now()}`,
      recipe,
      stepIndex: -1,
      startedAt: timestamp,
      updatedAt: timestamp,
    };
    setState((current) => ({ ...current, makeSessions: [...current.makeSessions, session] }));
    return session.id;
  }, [state.makeSessions]);

  const updateMakeSession = useCallback((sessionId: string, patch: Partial<Pick<CatalogueMakeSession, 'stepIndex' | 'completedAt'>>) => {
    setState((current) => ({
      ...current,
      makeSessions: current.makeSessions.map((session) => session.id === sessionId
        ? { ...session, ...patch, updatedAt: new Date().toISOString() }
        : session),
    }));
  }, []);

  const value = useMemo<CatalogueContextValue>(() => ({
    hydrated,
    persistenceError,
    inventory: state.inventory,
    makeSessions: state.makeSessions,
    addIngredient,
    addRecipeIngredients,
    removeIngredient,
    setIngredientStatus,
    startMakeSession,
    updateMakeSession,
  }), [addIngredient, addRecipeIngredients, hydrated, persistenceError, removeIngredient, setIngredientStatus, startMakeSession, state.inventory, state.makeSessions, updateMakeSession]);

  return <CatalogueContext.Provider value={value}>{children}</CatalogueContext.Provider>;
}

export function useCatalogueUserState(): CatalogueContextValue {
  const value = useContext(CatalogueContext);
  if (!value) throw new Error('useCatalogueUserState must be used inside CatalogueProvider.');
  return value;
}
