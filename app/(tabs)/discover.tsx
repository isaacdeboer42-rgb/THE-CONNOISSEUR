import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CatalogueApiError, mixologyToolsCatalogue } from '@/catalogue/mixologyTools';
import type { CatalogueIngredient, CatalogueRecipe, CatalogueStats } from '@/catalogue/types';
import { isCatalogueRecipeVisible } from '@/catalogue/validation';
import { RecipeCard } from '@/components/RecipeCard';
import { Button, EmptyState, Eyebrow, InlinePill, Screen } from '@/components/ui';
import { useBar } from '@/state/BarProvider';
import { useCatalogueUserState } from '@/state/CatalogueProvider';
import { colors, contentMaxWidth, fonts, radius, spacing } from '@/theme/tokens';

type BrowseMode = 'cocktails' | 'liquors' | 'bar';

const RECIPE_PAGE_SIZE = 30;
const INGREDIENT_PAGE_SIZE = 40;

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [delayMs, value]);

  return debounced;
}

function isAbortError(error: unknown): boolean {
  return (error instanceof CatalogueApiError && error.code === 'aborted')
    || (error instanceof Error && error.name === 'AbortError');
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return 'The broad catalogue could not be reached. Your local bar and reviewed recipes are still available.';
}

function ModeButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.modeButton,
        selected && styles.modeButtonSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.modeButtonText, selected && styles.modeButtonTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function RemoteRecipeCard({ recipe, onPress }: { recipe: CatalogueRecipe; onPress: () => void }) {
  const ingredientPreview = recipe.ingredients
    .slice(0, 4)
    .map((ingredient) => ingredient.ingredientName)
    .join(' · ');
  const sourceLabel = recipe.source?.trim() || (recipe.sourceUrl ? 'Source retained' : 'Community catalogue');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${recipe.name}. ${recipe.ingredients.length} ingredients.`}
      accessibilityHint="Opens catalogue recipe details"
      onPress={onPress}
      style={({ pressed }) => [styles.catalogueCard, pressed && styles.pressed]}
    >
      <View style={styles.catalogueCardTop}>
        <View style={styles.pillRow}>
          <InlinePill label={recipe.abv?.display || 'ABV unavailable'} tone="brass" />
          <InlinePill label="Complete reference" tone="ready" />
        </View>
        <Text style={styles.arrow}>↗</Text>
      </View>
      <Text accessibilityRole="header" style={styles.catalogueName}>{recipe.name}</Text>
      <Text numberOfLines={2} style={styles.catalogueIngredients}>
        {ingredientPreview || 'Ingredient details are available inside'}
        {recipe.ingredients.length > 4 ? ` · +${recipe.ingredients.length - 4} more` : ''}
      </Text>
      {recipe.description?.trim() ? (
        <Text numberOfLines={2} style={styles.catalogueDescription}>{recipe.description.trim()}</Text>
      ) : null}
      <View style={styles.cardFooter}>
        <Text style={styles.cardMeta}>{sourceLabel}</Text>
        <Text style={styles.cardMeta}>{recipe.ingredients.length} ingredients</Text>
      </View>
    </Pressable>
  );
}

function IngredientCard({
  ingredient,
  inBar,
  onAdd,
}: {
  ingredient: CatalogueIngredient;
  inBar: boolean;
  onAdd: () => void;
}) {
  const abv = ingredient.percentAbv;
  const path = ingredient.path?.trim();
  const isAlcoholic = abv !== undefined && abv > 0;

  return (
    <View style={styles.catalogueCard}>
      <View style={styles.catalogueCardTop}>
        <InlinePill
          label={abv === undefined ? 'ABV unavailable' : `${abv.toFixed(abv % 1 === 0 ? 0 : 1)}% ABV`}
          tone={isAlcoholic ? 'brass' : 'neutral'}
        />
        <Text style={styles.ingredientId}>#{ingredient.id}</Text>
      </View>
      <Text accessibilityRole="header" style={styles.catalogueName}>{ingredient.name}</Text>
      {ingredient.description?.trim() ? (
        <Text numberOfLines={3} style={styles.catalogueDescription}>{ingredient.description.trim()}</Text>
      ) : null}
      <View style={styles.ingredientMeta}>
        <Text style={styles.metaLabel}>CATALOGUE PATH</Text>
        <Text selectable style={styles.pathText}>{path || `/${ingredient.id}/`}</Text>
      </View>
      <Text style={styles.cardMeta}>
        {isAlcoholic
          ? ingredient.allowSubstitution
            ? 'Branded expression or substitutable liquor'
            : 'Canonical spirit or liquor'
          : 'Non-alcoholic cocktail ingredient'}
      </Text>
      <Button label={inBar ? 'Already in My Bar' : 'Add to My Bar'} variant="secondary" disabled={inBar} onPress={onAdd} />
    </View>
  );
}

export default function DiscoverScreen() {
  const router = useRouter();
  const { recommendations } = useBar();
  const { inventory: catalogueInventory, addIngredient } = useCatalogueUserState();
  const [mode, setMode] = useState<BrowseMode>('cocktails');
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim(), 400);
  const [recipes, setRecipes] = useState<CatalogueRecipe[]>([]);
  const [recipeCursor, setRecipeCursor] = useState<string>();
  const [hasMoreRecipes, setHasMoreRecipes] = useState(false);
  const [ingredients, setIngredients] = useState<CatalogueIngredient[]>([]);
  const [visibleIngredientCount, setVisibleIngredientCount] = useState(INGREDIENT_PAGE_SIZE);
  const [stats, setStats] = useState<CatalogueStats>();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);
  const loadMoreController = useRef<AbortController | undefined>(undefined);

  const barResults = useMemo(() => {
    const normalizedQuery = debouncedQuery.toLowerCase();
    return recommendations.filter((match) =>
      `${match.recipe.name} ${match.recipe.eyebrow}`.toLowerCase().includes(normalizedQuery),
    );
  }, [debouncedQuery, recommendations]);

  useEffect(() => {
    const controller = new AbortController();
    void mixologyToolsCatalogue.getStats({ signal: controller.signal })
      .then((nextStats) => setStats(nextStats))
      .catch((nextError: unknown) => {
        if (!isAbortError(nextError)) setStats(undefined);
      });
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    if (mode === 'bar') {
      setLoading(false);
      setError(undefined);
      return;
    }

    const controller = new AbortController();
    loadMoreController.current?.abort();
    setLoadingMore(false);
    setLoading(true);
    setError(undefined);

    if (mode === 'cocktails') {
      void mixologyToolsCatalogue.searchRecipes({
        query: debouncedQuery || undefined,
        limit: RECIPE_PAGE_SIZE,
        signal: controller.signal,
      }).then((result) => {
        setRecipes(result.recipes.filter(isCatalogueRecipeVisible));
        setRecipeCursor(result.pagination.nextCursor);
        setHasMoreRecipes(result.pagination.hasNext);
      }).catch((nextError: unknown) => {
        if (!isAbortError(nextError)) {
          setRecipes([]);
          setError(errorMessage(nextError));
        }
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    } else {
      const request = debouncedQuery
        ? mixologyToolsCatalogue.searchIngredients(debouncedQuery, { signal: controller.signal })
        : mixologyToolsCatalogue.listIngredients({ signal: controller.signal });
      void request.then((result) => {
        setIngredients(debouncedQuery ? result : result.filter((ingredient) => (ingredient.percentAbv ?? 0) > 0));
        setVisibleIngredientCount(INGREDIENT_PAGE_SIZE);
      }).catch((nextError: unknown) => {
        if (!isAbortError(nextError)) {
          setIngredients([]);
          setError(errorMessage(nextError));
        }
      }).finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    }

    return () => controller.abort();
  }, [debouncedQuery, mode, reloadKey]);

  useEffect(() => () => loadMoreController.current?.abort(), []);

  const changeMode = (nextMode: BrowseMode) => {
    setMode(nextMode);
    setQuery('');
    setError(undefined);
  };

  const loadMoreRecipes = async () => {
    if (!recipeCursor || loadingMore) return;
    loadMoreController.current?.abort();
    const controller = new AbortController();
    loadMoreController.current = controller;
    setLoadingMore(true);
    setError(undefined);
    try {
      const result = await mixologyToolsCatalogue.searchRecipes({
        query: debouncedQuery || undefined,
        limit: RECIPE_PAGE_SIZE,
        cursor: recipeCursor,
        signal: controller.signal,
      });
      setRecipes((current) => {
        const seen = new Set(current.map((recipe) => recipe.id));
        return [
          ...current,
          ...result.recipes.filter((recipe) => isCatalogueRecipeVisible(recipe) && !seen.has(recipe.id)),
        ];
      });
      setRecipeCursor(result.pagination.nextCursor);
      setHasMoreRecipes(result.pagination.hasNext);
    } catch (nextError: unknown) {
      if (!isAbortError(nextError)) setError(errorMessage(nextError));
    } finally {
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  };

  const header = (
    <View>
      <View style={styles.header}>
        <Eyebrow>Open catalogue</Eyebrow>
        <Text accessibilityRole="header" style={styles.title}>Discover</Text>
        <Text style={styles.subtitle}>
          Search a broad cocktail and liquor reference, or switch to the smaller reviewed collection matched to your bar.
        </Text>
      </View>

      <View accessibilityRole="tablist" style={styles.modeRow}>
        <ModeButton label="Cocktails" selected={mode === 'cocktails'} onPress={() => changeMode('cocktails')} />
        <ModeButton label="Liquors" selected={mode === 'liquors'} onPress={() => changeMode('liquors')} />
        <ModeButton label="For my bar" selected={mode === 'bar'} onPress={() => changeMode('bar')} />
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchGlyph}>⌕</Text>
        <TextInput
          accessibilityLabel={mode === 'liquors' ? 'Search liquors and ingredients' : 'Search recipes'}
          value={query}
          onChangeText={setQuery}
          placeholder={mode === 'liquors' ? 'Search bourbon, liqueur, brand…' : 'Search the collection'}
          placeholderTextColor={colors.paperDim}
          returnKeyType="search"
          autoCorrect={false}
          style={styles.search}
        />
        {query ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} hitSlop={8}>
            <Text style={styles.clear}>×</Text>
          </Pressable>
        ) : null}
      </View>

      {mode !== 'bar' ? (
        <View style={styles.sourceNotice}>
          <Text style={styles.sourceMark}>✦</Text>
          <Text style={styles.sourceCopy}>
            Complete community references via Mixology Tools · {stats ? `${stats.recipeCount.toLocaleString()} provider cocktails · ${stats.ingredientCount.toLocaleString()} liquor and ingredient entries` : 'live public catalogue'} · blocked and incomplete recipes are excluded.
          </Text>
        </View>
      ) : (
        <View style={styles.reviewedNotice}>
          <Text style={styles.sourceCopy}>These recipes pass The Connoisseur editorial gate and include availability, scaling and guided Make mode.</Text>
        </View>
      )}

      <Text style={styles.resultCount}>
        {mode === 'cocktails'
          ? `${recipes.length}${hasMoreRecipes ? '+' : ''} ${recipes.length === 1 ? 'cocktail' : 'cocktails'} shown`
          : mode === 'liquors'
            ? `${Math.min(visibleIngredientCount, ingredients.length)} of ${ingredients.length} entries shown`
            : `${barResults.length} ${barResults.length === 1 ? 'reviewed recipe' : 'reviewed recipes'}`}
      </Text>
    </View>
  );

  const empty = loading ? (
    <View style={styles.loadingState} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.brass} />
      <Text style={styles.loadingText}>Searching the catalogue…</Text>
    </View>
  ) : error ? (
    <EmptyState
      glyph="!"
      title="The broad catalogue is unavailable"
      body={error}
      action={<Button label="Try again" onPress={() => setReloadKey((value) => value + 1)} />}
    />
  ) : (
    <EmptyState
      glyph="⌕"
      title="No matches found"
      body="Try a shorter name, a spirit family, or a different spelling."
      action={query ? <Button label="Clear search" variant="secondary" onPress={() => setQuery('')} /> : undefined}
    />
  );

  if (mode === 'bar') {
    return (
      <Screen>
        <FlatList
          data={barResults}
          keyExtractor={(match) => match.recipe.id}
          renderItem={({ item }) => (
            <RecipeCard match={item} onPress={() => router.push(`/recipe/${item.recipe.id}`)} />
          )}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      </Screen>
    );
  }

  if (mode === 'liquors') {
    const visibleIngredients = ingredients.slice(0, visibleIngredientCount);
    const hasMoreIngredients = visibleIngredientCount < ingredients.length;
    return (
      <Screen>
        <FlatList
          data={visibleIngredients}
          keyExtractor={(ingredient) => String(ingredient.id)}
          renderItem={({ item }) => (
            <IngredientCard
              ingredient={item}
              inBar={catalogueInventory.some((entry) => entry.ingredientId === item.id)}
              onAdd={() => addIngredient(item)}
            />
          )}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          ListFooterComponent={hasMoreIngredients ? (
            <View style={styles.footerAction}>
              <Button
                label={`Show ${Math.min(INGREDIENT_PAGE_SIZE, ingredients.length - visibleIngredientCount)} more`}
                variant="secondary"
                onPress={() => setVisibleIngredientCount((count) => count + INGREDIENT_PAGE_SIZE)}
              />
            </View>
          ) : undefined}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={recipes}
        keyExtractor={(recipe) => String(recipe.id)}
        renderItem={({ item }) => (
          <RemoteRecipeCard
            recipe={item}
            onPress={() => router.push(`/catalogue-recipe/${item.id}` as never)}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={hasMoreRecipes || loadingMore ? (
          <View style={styles.footerAction}>
            <Button
              label={loadingMore ? 'Loading more…' : 'Load more cocktails'}
              variant="secondary"
              disabled={loadingMore}
              onPress={() => void loadMoreRecipes()}
            />
          </View>
        ) : undefined}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: 120,
  },
  header: { paddingTop: spacing.md },
  title: { color: colors.paper, fontFamily: fonts.display, fontSize: 38, marginTop: 3 },
  subtitle: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, maxWidth: 600, marginTop: spacing.sm },
  modeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xxl },
  modeButton: { flex: 1, minHeight: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  modeButtonSelected: { borderColor: colors.brass, backgroundColor: colors.brassSoft },
  modeButtonText: { color: colors.paperMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  modeButtonTextSelected: { color: colors.brass },
  pressed: { opacity: 0.72 },
  searchWrap: { marginTop: spacing.md, minHeight: 52, flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, gap: spacing.md },
  searchGlyph: { color: colors.brass, fontFamily: fonts.body, fontSize: 20 },
  search: { flex: 1, color: colors.paper, fontFamily: fonts.body, fontSize: 14 },
  clear: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 24, lineHeight: 28 },
  sourceNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginTop: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(215,170,98,0.2)', backgroundColor: colors.brassSoft, padding: spacing.md },
  reviewedNotice: { marginTop: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(169,214,141,0.2)', backgroundColor: colors.readyDeep, padding: spacing.md },
  sourceMark: { color: colors.brass, fontFamily: fonts.body, fontSize: 13 },
  sourceCopy: { flex: 1, color: colors.paperMuted, fontFamily: fonts.body, fontSize: 11, lineHeight: 17 },
  resultCount: { color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.md },
  separator: { height: spacing.md },
  catalogueCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, padding: spacing.xl, gap: spacing.md },
  catalogueCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  arrow: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 19 },
  catalogueName: { color: colors.paper, fontFamily: fonts.display, fontSize: 29, lineHeight: 34 },
  catalogueIngredients: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 17 },
  catalogueDescription: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 20 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  cardMeta: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, lineHeight: 16 },
  ingredientId: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11 },
  ingredientMeta: { gap: 3, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.inkRaised },
  metaLabel: { color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 10, letterSpacing: 1.1 },
  pathText: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 11 },
  loadingState: { minHeight: 210, alignItems: 'center', justifyContent: 'center', borderRadius: radius.xl, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
  loadingText: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 13, marginTop: spacing.md },
  footerAction: { paddingTop: spacing.xl },
});
