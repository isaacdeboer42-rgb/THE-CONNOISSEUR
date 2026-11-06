import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { RecipeCard } from '@/components/RecipeCard';
import { Button, EmptyState, Eyebrow, Screen, ScreenScroll, SectionHeading } from '@/components/ui';
import { archivedRecipeById, recipeById } from '@/data/catalog';
import { ArchivedRecipeId } from '@/domain/types';
import { matchRecipe } from '@/domain/matching';
import { useBar } from '@/state/BarProvider';
import { colors, fonts, spacing } from '@/theme/tokens';

export default function SavedScreen() {
  const router = useRouter();
  const { snapshot, toggleSaved } = useBar();
  const withdrawn = useMemo(
    () =>
      [...snapshot.savedRecipes]
        .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
        .flatMap((saved) => {
          const archived = archivedRecipeById[saved.recipeId as ArchivedRecipeId];
          return archived ? [{ ...archived, savedAt: saved.savedAt }] : [];
        }),
    [snapshot.savedRecipes],
  );
  const families = useMemo(() => {
    const byFamily = new Map<
      string,
      Array<{ savedAt: string; match: ReturnType<typeof matchRecipe> }>
    >();
    [...snapshot.savedRecipes]
      .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
      .forEach((saved) => {
        if (saved.recipeId === 'classic-martini') return;
        const recipe = recipeById[saved.recipeId];
        if (!recipe) return;
        const entry = {
          savedAt: saved.savedAt,
          match: matchRecipe(recipe, snapshot.inventory, snapshot.basics),
        };
        byFamily.set(recipe.familyId, [...(byFamily.get(recipe.familyId) ?? []), entry]);
      });
    return [...byFamily.entries()];
  }, [snapshot.basics, snapshot.inventory, snapshot.savedRecipes]);

  return (
    <Screen>
      <ScreenScroll>
        <View style={styles.header}>
          <Eyebrow>Your shortlist</Eyebrow>
          <Text accessibilityRole="header" style={styles.title}>Saved</Text>
          <Text style={styles.subtitle}>Availability is recalculated whenever your bar changes.</Text>
        </View>
        {families.length === 0 && withdrawn.length === 0 ? (
          <EmptyState
            glyph="♡"
            title="Keep a drink for later"
            body="Save any reviewed recipe and it will wait here with its current availability."
            action={<Button label="Browse recipes" onPress={() => router.push('/(tabs)/discover')} />}
          />
        ) : (
          <View style={styles.familyList}>
            {families.map(([familyId, entries]) => (
              <View key={familyId} style={styles.family}>
                <SectionHeading
                  eyebrow={`${entries.length} saved ${entries.length === 1 ? 'variant' : 'variants'}`}
                  title={entries[0].match.recipe.name.replace(/^The /, '')}
                />
                <View style={styles.list}>
                  {entries.map(({ match, savedAt }) => (
                    <View key={match.recipe.id}>
                      <Text style={styles.savedAt}>
                        Saved {new Date(savedAt).toLocaleDateString()}
                      </Text>
                      <RecipeCard
                        match={match}
                        onPress={() => router.push(`/recipe/${match.recipe.id}`)}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ))}
            {withdrawn.length ? (
              <View style={styles.family}>
                <SectionHeading eyebrow="Saved history" title="Unavailable recipes" />
                {withdrawn.map((recipe) => (
                  <View key={recipe.id} style={styles.withdrawnCard}>
                    <Text style={styles.withdrawnLabel}>WITHDRAWN · SAVED REFERENCE RETAINED</Text>
                    <Text style={styles.withdrawnTitle}>{recipe.name}</Text>
                    <Text style={styles.withdrawnBody}>{recipe.reason}</Text>
                    <Text style={styles.savedAt}>Saved {new Date(recipe.savedAt).toLocaleDateString()}</Text>
                    <Button
                      label="Remove from saved"
                      variant="ghost"
                      onPress={() => toggleSaved(recipe.id)}
                    />
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.md, marginBottom: spacing.xxl },
  title: { color: colors.paper, fontFamily: fonts.display, fontSize: 38, marginTop: 3 },
  subtitle: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 14, marginTop: spacing.sm },
  familyList: { gap: spacing.huge },
  family: { gap: spacing.lg },
  list: { gap: spacing.md },
  savedAt: {
    color: colors.paperDim,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  withdrawnCard: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 16,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  withdrawnLabel: { color: colors.alert, fontFamily: fonts.bodyMedium, fontSize: 10, letterSpacing: 1 },
  withdrawnTitle: { color: colors.paper, fontFamily: fonts.display, fontSize: 25 },
  withdrawnBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
});
