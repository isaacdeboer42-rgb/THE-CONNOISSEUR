import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, EmptyState, Eyebrow, IconButton, InlinePill, Screen, ScreenScroll, SectionHeading } from '@/components/ui';
import { ingredientById, recipeById } from '@/data/catalog';
import { linkedRecipeIds } from '@/domain/shopping';
import { useBar } from '@/state/BarProvider';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

type SortMode = 'taste' | 'unlock';

export default function ShoppingScreen() {
  const router = useRouter();
  const {
    snapshot,
    purchaseSuggestions,
    addShoppingItem,
    removeShoppingItem,
  } = useBar();
  const [sortMode, setSortMode] = useState<SortMode>('taste');
  const owned = new Set(
    snapshot.inventory
      .filter((item) => item.status === 'onHand')
      .map((item) => item.ingredientId),
  );
  const sortedSuggestions = useMemo(
    () =>
      [...purchaseSuggestions].sort((left, right) =>
        sortMode === 'taste'
          ? right.tasteScore - left.tasteScore || right.newlyReadyFamilyCount - left.newlyReadyFamilyCount
          : right.newlyReadyFamilyCount - left.newlyReadyFamilyCount || right.tasteScore - left.tasteScore,
      ),
    [purchaseSuggestions, sortMode],
  );

  return (
    <Screen>
      <ScreenScroll contentStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <IconButton label="Go back" glyph="‹" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/bar')} />
          <Text style={styles.topLabel}>SHOPPING & POSSIBILITIES</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push('/preferences')}>
            <Text style={styles.profileLink}>Taste profile</Text>
          </Pressable>
        </View>

        <Eyebrow>Buy with purpose</Eyebrow>
        <Text accessibilityRole="header" style={styles.title}>A smarter next bottle.</Text>
        <Text style={styles.subtitle}>Every unlock count is simulated against your current bar and expands into the recipes behind it.</Text>

        <View style={styles.section}>
          <SectionHeading eyebrow={`${snapshot.shoppingItems.length} items`} title="My shopping list" />
          {snapshot.shoppingItems.length === 0 ? (
            <EmptyState
              glyph="＋"
              title="Nothing on the list yet"
              body="Add a missing ingredient from a recipe or choose one of the useful additions below."
            />
          ) : (
            <View style={styles.list}>
              {snapshot.shoppingItems.map((item) => {
                const ingredient = ingredientById[item.ingredientId];
                const related = linkedRecipeIds(item.ingredientId);
                const isOwned = owned.has(item.ingredientId) || Boolean(item.ownedAt);
                return (
                  <View key={item.ingredientId} style={styles.shoppingCard}>
                    <View style={styles.shoppingTop}>
                      <View style={styles.ingredientMark}><Text style={styles.ingredientInitial}>{ingredient.shortName.charAt(0)}</Text></View>
                      <View style={styles.shoppingCopy}>
                        <Text style={styles.shoppingName}>{ingredient.name}</Text>
                        <Text style={styles.shoppingMeta}>
                          {related.length
                            ? `Linked to ${related.map((id) => recipeById[id].name).join(', ')}`
                            : 'Saved for your bar'}
                        </Text>
                      </View>
                      <InlinePill label={isOwned ? 'Owned' : 'To buy'} tone={isOwned ? 'ready' : 'brass'} />
                    </View>
                    {isOwned ? <Text style={styles.ownedNote}>This stays visible until you choose to remove it.</Text> : null}
                    <Button label="Remove from list" variant="ghost" onPress={() => removeShoppingItem(item.ingredientId)} />
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <SectionHeading eyebrow="Simulated additions" title="What opens up next" />
          <View style={styles.sorter} accessibilityRole="radiogroup">
            {([
              ['taste', 'For my taste'],
              ['unlock', 'Most new cocktails'],
            ] as const).map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected: sortMode === value }}
                onPress={() => setSortMode(value)}
                style={[styles.sortOption, sortMode === value && styles.sortOptionActive]}
              >
                <Text style={[styles.sortText, sortMode === value && styles.sortTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.suggestions}>
            {sortedSuggestions.map((suggestion) => {
              const ingredient = ingredientById[suggestion.ingredientId];
              const onList = snapshot.shoppingItems.some((item) => item.ingredientId === suggestion.ingredientId);
              return (
                <View key={suggestion.ingredientId} style={styles.suggestionCard}>
                  <View style={styles.suggestionHeader}>
                    <View style={styles.suggestionCopy}>
                      <Text style={styles.suggestionName}>{ingredient.name}</Text>
                      <Text style={styles.suggestionCategory}>{ingredient.category}</Text>
                    </View>
                    <View style={styles.unlockCount}>
                      <Text style={styles.unlockValue}>{suggestion.newlyReadyFamilyCount}</Text>
                      <Text style={styles.unlockLabel}>{suggestion.newlyReadyFamilyCount === 1 ? 'FAMILY' : 'FAMILIES'} READY</Text>
                    </View>
                  </View>

                  {suggestion.supportingRecipeIds.length ? (
                    <View style={styles.evidenceBlock}>
                      <Text style={styles.evidenceLabel}>BECOMES READY</Text>
                      <Text style={styles.evidenceText}>{suggestion.supportingRecipeIds.map((id) => recipeById[id].name).join(' · ')}</Text>
                    </View>
                  ) : null}
                  {suggestion.closerRecipeIds.length ? (
                    <View style={styles.evidenceBlock}>
                      <Text style={styles.evidenceLabel}>GETS YOU CLOSER</Text>
                      <Text style={styles.evidenceText}>{suggestion.closerRecipeIds.map((id) => recipeById[id].name).join(' · ')}</Text>
                    </View>
                  ) : null}
                  {suggestion.savedRecipeCount ? (
                    <Text style={styles.savedUnlock}>{suggestion.savedRecipeCount} saved {suggestion.savedRecipeCount === 1 ? 'recipe' : 'recipes'} unlocked</Text>
                  ) : null}
                  <Button
                    label={onList ? 'Already on my list' : 'Add to shopping list'}
                    variant="secondary"
                    disabled={onList}
                    onPress={() => addShoppingItem(suggestion.ingredientId)}
                  />
                </View>
              );
            })}
          </View>
        </View>
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: spacing.huge },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, marginBottom: spacing.xxxl },
  topLabel: { color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 8, letterSpacing: 1.2 },
  profileLink: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 10 },
  title: { color: colors.paper, fontFamily: fonts.display, fontSize: 43, lineHeight: 49, marginTop: spacing.sm },
  subtitle: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 15, lineHeight: 23, maxWidth: 610, marginTop: spacing.md },
  section: { marginTop: spacing.huge, gap: spacing.lg },
  list: { gap: spacing.md },
  shoppingCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.md },
  shoppingTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  ingredientMark: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brassSoft, alignItems: 'center', justifyContent: 'center' },
  ingredientInitial: { color: colors.brass, fontFamily: fonts.display, fontSize: 19 },
  shoppingCopy: { flex: 1 },
  shoppingName: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 13 },
  shoppingMeta: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 10, lineHeight: 15, marginTop: 3 },
  ownedNote: { color: colors.ready, fontFamily: fonts.body, fontSize: 10 },
  sorter: { flexDirection: 'row', borderRadius: radius.pill, backgroundColor: colors.surface, padding: 3 },
  sortOption: { flex: 1, minHeight: 42, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  sortOptionActive: { backgroundColor: colors.brassSoft },
  sortText: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 10 },
  sortTextActive: { color: colors.brass, fontFamily: fonts.bodyMedium },
  suggestions: { gap: spacing.md },
  suggestionCard: { borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(215,170,98,0.2)', backgroundColor: colors.surfaceWarm, padding: spacing.xl, gap: spacing.md },
  suggestionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.lg },
  suggestionCopy: { flex: 1 },
  suggestionName: { color: colors.paper, fontFamily: fonts.display, fontSize: 25 },
  suggestionCategory: { color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 3 },
  unlockCount: { alignItems: 'flex-end' },
  unlockValue: { color: colors.brass, fontFamily: fonts.display, fontSize: 31 },
  unlockLabel: { color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 7, letterSpacing: 0.8 },
  evidenceBlock: { borderLeftWidth: 2, borderLeftColor: colors.brass, paddingLeft: spacing.md },
  evidenceLabel: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 8, letterSpacing: 1.1 },
  evidenceText: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 11, lineHeight: 17, marginTop: 3 },
  savedUnlock: { color: colors.ready, fontFamily: fonts.bodyMedium, fontSize: 10 },
});
