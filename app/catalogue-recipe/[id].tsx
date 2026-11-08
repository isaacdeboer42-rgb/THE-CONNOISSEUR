import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';

import { CatalogueApiError, mixologyToolsCatalogue } from '@/catalogue/mixologyTools';
import { CatalogueRecipe } from '@/catalogue/types';
import { auditCatalogueRecipe } from '@/catalogue/validation';
import {
  Button,
  EmptyState,
  Eyebrow,
  IconButton,
  InlinePill,
  Screen,
  ScreenScroll,
  SectionHeading,
} from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/theme/tokens';
import { useCatalogueUserState } from '@/state/CatalogueProvider';

function sourceUrlFor(recipe: CatalogueRecipe): string | undefined {
  if (!recipe.sourceUrl) return undefined;
  try {
    const url = new URL(recipe.sourceUrl);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function requestErrorMessage(error: unknown): string {
  if (error instanceof CatalogueApiError) {
    if (error.code === 'http' && error.status === 404) {
      return 'This catalogue recipe is no longer available from the upstream source.';
    }
    if (error.code === 'timeout') return 'The catalogue took too long to respond. Try again when the connection is steadier.';
    if (error.code === 'network') return 'The catalogue could not be reached. Check the connection and try again.';
    if (error.code === 'invalid-response') return 'The catalogue returned an unsupported recipe record.';
  }
  return 'The catalogue recipe could not be opened right now.';
}

export default function CatalogueRecipeDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const rawId = Array.isArray(params.id) ? params.id[0] : params.id;
  const recipeId = Number(rawId);
  const validRecipeId = Number.isInteger(recipeId) && recipeId > 0;
  const [recipe, setRecipe] = useState<CatalogueRecipe>();
  const [loading, setLoading] = useState(validRecipeId);
  const [error, setError] = useState<string>();
  const [reloadKey, setReloadKey] = useState(0);
  const { inventory, addIngredient, addRecipeIngredients, startMakeSession } = useCatalogueUserState();

  useEffect(() => {
    if (!validRecipeId) {
      setRecipe(undefined);
      setLoading(false);
      setError('This catalogue recipe link is not valid.');
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(undefined);
    void mixologyToolsCatalogue.getRecipe(recipeId, { signal: controller.signal })
      .then((result) => setRecipe(result))
      .catch((nextError: unknown) => {
        if (nextError instanceof CatalogueApiError && nextError.code === 'aborted') return;
        setRecipe(undefined);
        setError(requestErrorMessage(nextError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [recipeId, reloadKey, validRecipeId]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/discover'));

  if (loading) {
    return (
      <Screen>
        <View style={styles.loading} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.brass} />
          <Text style={styles.loadingText}>Opening catalogue recipe…</Text>
        </View>
      </Screen>
    );
  }

  if (!recipe || error) {
    return (
      <Screen>
        <ScreenScroll contentStyle={styles.scrollContent}>
          <View style={styles.topBar}>
            <IconButton label="Go back" glyph="‹" onPress={goBack} />
          </View>
          <EmptyState
            glyph="!"
            title="Catalogue recipe unavailable"
            body={error ?? 'This catalogue recipe is not available.'}
            action={validRecipeId ? (
              <Button label="Try again" onPress={() => setReloadKey((value) => value + 1)} />
            ) : (
              <Button label="Back to Discover" onPress={goBack} />
            )}
          />
        </ScreenScroll>
      </Screen>
    );
  }

  const sourceUrl = sourceUrlFor(recipe);
  const sourceLabel = recipe.source?.trim() || 'Community catalogue';
  const instructions = recipe.instructions?.trim();
  const audit = auditCatalogueRecipe(recipe);
  const inventoryIds = new Set(inventory.map((item) => item.ingredientId));

  if (!audit.makeReady) {
    return (
      <Screen>
        <ScreenScroll contentStyle={styles.scrollContent}>
          <View style={styles.topBar}>
            <IconButton label="Go back" glyph="‹" onPress={goBack} />
          </View>
          <EmptyState
            glyph="!"
            title="Recipe excluded"
            body="This upstream record is incomplete and is not part of The Connoisseur catalogue."
            action={<Button label="Back to Discover" onPress={goBack} />}
          />
        </ScreenScroll>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenScroll contentStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <IconButton label="Go back" glyph="‹" onPress={goBack} />
          <Text style={styles.topLabel}>OPEN REFERENCE · #{recipe.id}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.hero}>
          <InlinePill label={recipe.abv?.display || 'ABV unavailable'} tone="brass" />
          <Eyebrow>Community catalogue</Eyebrow>
          <Text accessibilityRole="header" style={styles.title}>{recipe.name}</Text>
          {recipe.description?.trim() ? <Text style={styles.description}>{recipe.description.trim()}</Text> : null}
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>{recipe.ingredients.length} ingredients</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{sourceLabel}</Text>
          </View>
        </View>

        <View style={styles.referenceNotice} accessibilityRole="summary">
          <Text style={styles.noticeGlyph}>i</Text>
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>Reference recipe</Text>
            <Text style={styles.noticeBody}>
              This record is structurally complete for guided reference mode. Quantities, method and rights still need human editorial confirmation.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading eyebrow="As supplied" title="Ingredients" />
          <View style={styles.ingredientList}>
            {recipe.ingredients.map((ingredient, index) => {
              const measure = [ingredient.amount, ingredient.unitAbbreviation || ingredient.unitName]
                .filter((value) => value !== undefined && value !== '')
                .join(' ');
              return (
                <View key={`${ingredient.ingredientId}-${index}`} style={styles.ingredientRow}>
                  <Text style={styles.ingredientMeasure}>{measure || '—'}</Text>
                  <View style={styles.ingredientCopy}>
                    <Text style={styles.ingredientName}>{ingredient.fullName || ingredient.ingredientName}</Text>
                    {ingredient.hierarchy?.length ? (
                      <Text style={styles.ingredientPath}>{ingredient.hierarchy.join(' › ')}</Text>
                    ) : null}
                  </View>
                  <Button
                    label={inventoryIds.has(ingredient.ingredientId) ? 'In bar' : 'Add'}
                    variant="ghost"
                    disabled={inventoryIds.has(ingredient.ingredientId)}
                    style={styles.ingredientAdd}
                    onPress={() => addIngredient(ingredient)}
                  />
                </View>
              );
            })}
          </View>
          <Button
            label="Add all ingredients to My Bar"
            variant="secondary"
            onPress={() => addRecipeIngredients(recipe)}
          />
        </View>

        <View style={styles.section}>
          <SectionHeading eyebrow="Upstream method" title="Instructions" />
          <View style={styles.instructionsCard}>
            <Text style={styles.instructionsText}>
              {instructions || 'The upstream source did not provide instructions for this record.'}
            </Text>
          </View>
        </View>

        {recipe.tags.length ? (
          <View style={styles.section}>
            <SectionHeading eyebrow="Catalogue labels" title="Tags" />
            <View style={styles.tags}>
              {recipe.tags.map((tag) => <InlinePill key={tag.id} label={tag.name} />)}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeading eyebrow="Automated audit" title="Structurally complete" />
          <View style={styles.auditCard}>
            {audit.issues.map((issue) => (
              <View key={`${issue.code}-${issue.field}`} style={styles.auditRow}>
                <Text style={[styles.auditBadge, issue.severity === 'blocking' && styles.auditBadgeBlocking]}>
                  {issue.severity === 'blocking' ? 'BLOCKER' : 'CHECK'}
                </Text>
                <Text style={styles.auditText}>{issue.message}</Text>
              </View>
            ))}
          </View>
          <Button
            label="Start guided Make"
            onPress={() => {
              const sessionId = startMakeSession(recipe);
              router.push(`/catalogue-make/${sessionId}` as never);
            }}
          />
        </View>

        <View style={styles.sourceCard}>
          <Text style={styles.sourceTitle}>Source and next step</Text>
          <Text style={styles.sourceBody}>
            Source identity is retained for attribution and editorial review. Additions to the reviewed collection require a versioned import and rights approval.
          </Text>
          {sourceUrl ? (
            <Button
              label="Open original source"
              variant="secondary"
              accessibilityHint="Opens the upstream recipe in your browser"
              onPress={() => void Linking.openURL(sourceUrl)}
            />
          ) : null}
        </View>
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: spacing.huge },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, marginBottom: spacing.xxl },
  topLabel: { color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.2 },
  headerSpacer: { width: 44 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  loadingText: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 14, marginTop: spacing.md },
  hero: { alignItems: 'flex-start', gap: spacing.md },
  title: { color: colors.paper, fontFamily: fonts.display, fontSize: 46, lineHeight: 52 },
  description: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 15, lineHeight: 23, maxWidth: 620 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  metaText: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11 },
  metaDot: { color: colors.brass, fontFamily: fonts.body, fontSize: 11 },
  referenceNotice: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xxl, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(215,170,98,0.24)', backgroundColor: colors.brassSoft },
  noticeGlyph: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.brass, color: colors.ink, textAlign: 'center', lineHeight: 26, fontFamily: fonts.bodyMedium, fontSize: 13 },
  noticeCopy: { flex: 1 },
  noticeTitle: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 13 },
  noticeBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 11, lineHeight: 17, marginTop: 4 },
  section: { marginTop: spacing.huge, gap: spacing.lg },
  ingredientList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  ingredientRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  ingredientMeasure: { width: 78, color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 12 },
  ingredientCopy: { flex: 1 },
  ingredientName: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 13 },
  ingredientPath: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, marginTop: 3 },
  ingredientAdd: { minHeight: 40, paddingHorizontal: spacing.md },
  instructionsCard: { padding: spacing.xl, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
  instructionsText: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 23 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  auditCard: { gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
  auditRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  auditBadge: { width: 58, color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 9, letterSpacing: 0.8 },
  auditBadgeBlocking: { color: colors.alert },
  auditText: { flex: 1, color: colors.paperMuted, fontFamily: fonts.body, fontSize: 11, lineHeight: 17 },
  sourceCard: { gap: spacing.md, marginTop: spacing.huge, padding: spacing.xl, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
  sourceTitle: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 13 },
  sourceBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 19 },
});
