import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ingredientById, ingredients } from '@/data/catalog';
import { iceChoicesConfirmed } from '@/domain/onboarding';
import { BasicId, IngredientId, StapleState } from '@/domain/types';
import { useBar } from '@/state/BarProvider';
import { colors, fonts, radius, spacing } from '@/theme/tokens';
import { Button, Eyebrow, IconButton, Screen, ScreenScroll } from '@/components/ui';

function BasicSelector({
  id,
  value,
  onChange,
}: {
  id: BasicId;
  value: StapleState;
  onChange: (value: StapleState) => void;
}) {
  const isStandard = id === 'standard-ice';
  const label = isStandard ? 'Standard ice' : 'Large ice';
  const glyph = isStandard ? '◇' : '◆';
  const description = isStandard
    ? 'Regular cubes for shaking and stirring.'
    : 'A large cube for serving the finished drink.';
  return (
    <View style={styles.stapleCard}>
      <View style={styles.stapleHeader}>
        <View style={styles.stapleGlyph}><Text style={styles.stapleGlyphText}>{glyph}</Text></View>
        <View style={styles.stapleCopy}>
          <Text style={styles.stapleTitle}>{label}</Text>
          <Text style={styles.stapleBody}>{description}</Text>
        </View>
      </View>
      <View style={styles.segmented} accessibilityRole="radiogroup" accessibilityLabel={`${label} availability`}>
        {([
          ['available', 'Yes'],
          ['unavailable', 'Not now'],
        ] as const).map(([option, optionLabel]) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === option }}
            onPress={() => onChange(option)}
            style={[styles.segment, value === option && styles.segmentSelected]}
          >
            <Text style={[styles.segmentText, value === option && styles.segmentTextSelected]}>{optionLabel}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function SetupScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const {
    snapshot,
    recommendations,
    addIngredient,
    removeIngredient,
    addStarter,
    setBasic,
    completeOnboarding,
  } = useBar();

  const inventoryIds = new Set(snapshot.inventory.filter((item) => item.status === 'onHand').map((item) => item.ingredientId));
  const outOfStockIds = new Set(snapshot.inventory.filter((item) => item.status === 'outOfStock').map((item) => item.ingredientId));
  const selectable = useMemo(
    () =>
      ingredients.filter((ingredient) => {
        if (ingredient.isStaple || ingredient.id === 'orange-peel') return false;
        const haystack = `${ingredient.name} ${ingredient.aliases.join(' ')} ${ingredient.category}`.toLowerCase();
        return haystack.includes(query.trim().toLowerCase());
      }),
    [query],
  );
  const readyCount = recommendations.filter((match) => match.category === 'ready').length;
  const nearCount = recommendations.filter((match) => match.category === 'oneAway').length;
  const iceConfirmed = iceChoicesConfirmed(snapshot.basics);

  return (
    <Screen>
      <ScreenScroll contentStyle={styles.scrollContent}>
        <View style={styles.header}>
          <IconButton label="Go back" glyph="‹" onPress={() => router.back()} />
          <Text style={styles.stepLabel}>YOUR BAR · STEP 1 OF 1</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Eyebrow>Start with what is nearby</Eyebrow>
        <Text accessibilityRole="header" style={styles.title}>What’s on your shelf?</Text>
        <Text style={styles.subtitle}>Three ingredients is a great start. You can add more whenever you like.</Text>

        {inventoryIds.size === 0 ? (
          <View style={styles.starterCard}>
            <View style={styles.starterBadge}><Text style={styles.starterBadgeText}>A GOOD START</Text></View>
            <Text style={styles.starterTitle}>The classic sour trio</Text>
            <Text style={styles.starterBody}>Bourbon, sugar syrup and egg white give us three useful first recommendations.</Text>
            <View style={styles.starterIngredients}>
              {(['bourbon', 'simple-syrup', 'egg-white'] as IngredientId[]).map((id) => (
                <View key={id} style={styles.miniChip}><Text style={styles.miniChipText}>{ingredientById[id].shortName}</Text></View>
              ))}
            </View>
            <Button label="Add all three" variant="secondary" onPress={addStarter} />
          </View>
        ) : null}

        <View style={styles.searchWrap}>
          <Text style={styles.searchGlyph}>⌕</Text>
          <TextInput
            accessibilityLabel="Search ingredients"
            value={query}
            onChangeText={setQuery}
            placeholder="Search bourbon, lemon, bitters…"
            placeholderTextColor={colors.paperDim}
            style={styles.search}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8} onPress={() => setQuery('')}>
              <Text style={styles.clearSearch}>×</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>{query ? 'Search results' : 'Popular ingredients'}</Text>
          <Text style={styles.listCount}>{inventoryIds.size} selected</Text>
        </View>
        <View style={styles.ingredientGrid}>
          {selectable.map((ingredient) => {
            const selected = inventoryIds.has(ingredient.id);
            const outOfStock = outOfStockIds.has(ingredient.id);
            return (
              <Pressable
                key={ingredient.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${ingredient.name}${outOfStock ? ', out of stock. Activate to restock' : ''}`}
                onPress={() => (selected ? removeIngredient(ingredient.id) : addIngredient(ingredient.id))}
                style={({ pressed }) => [styles.ingredientCard, selected && styles.ingredientCardSelected, outOfStock && styles.ingredientCardOutOfStock, pressed && styles.pressed]}
              >
                <View style={[styles.ingredientInitial, selected && styles.ingredientInitialSelected, outOfStock && styles.ingredientInitialOutOfStock]}>
                  <Text style={[styles.ingredientInitialText, selected && styles.ingredientInitialTextSelected, outOfStock && styles.ingredientInitialTextOutOfStock]}>
                    {selected ? '✓' : outOfStock ? '↻' : ingredient.shortName.charAt(0)}
                  </Text>
                </View>
                <View style={styles.ingredientCopy}>
                  <Text style={styles.ingredientName}>{ingredient.shortName}</Text>
                  <Text style={styles.ingredientCategory}>{outOfStock ? `${ingredient.category} · Out of stock` : ingredient.category}</Text>
                </View>
                <Text style={[styles.addGlyph, selected && styles.addGlyphSelected, outOfStock && styles.restockGlyph]}>
                  {selected ? 'Added' : outOfStock ? 'Restock' : '＋'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.sectionIntro}>
          <Eyebrow>Kitchen basics</Eyebrow>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Which ice do you keep?</Text>
          <Text style={styles.sectionBody}>Choose an answer for each type. Ice affects whether a drink is ready now, so we will not guess.</Text>
        </View>
        <View style={styles.staples}>
          <BasicSelector
            id="standard-ice"
            value={snapshot.basics['standard-ice']}
            onChange={(value) => setBasic('standard-ice', value)}
          />
          <BasicSelector
            id="large-ice"
            value={snapshot.basics['large-ice']}
            onChange={(value) => setBasic('large-ice', value)}
          />
        </View>

        <View style={styles.recommendationPreview} accessibilityLiveRegion="polite">
          <View style={styles.previewOrb}><Text style={styles.previewOrbText}>{readyCount + nearCount}</Text></View>
          <View style={styles.previewCopy}>
            <Text style={styles.previewTitle}>{readyCount + nearCount === 1 ? '1 promising drink' : `${readyCount + nearCount} promising drinks`}</Text>
            <Text style={styles.previewBody}>{readyCount} ready now · {nearCount} one ingredient away</Text>
          </View>
          <Text style={styles.previewSpark}>✦</Text>
        </View>

        <Button
          label="See my matches"
          disabled={!iceConfirmed}
          onPress={() => {
            completeOnboarding();
            router.replace('/(tabs)/tonight');
          }}
          accessibilityHint={iceConfirmed ? 'Opens tonight’s cocktail recommendations' : 'Choose Yes or Not now for both ice types first'}
        />
        <Text accessibilityLiveRegion="polite" style={[styles.skipNote, !iceConfirmed && styles.iceRequiredNote]}>
          {iceConfirmed
            ? 'Ice choices saved. You can change them whenever your freezer changes.'
            : 'Confirm both ice types above to see accurate matches.'}
        </Text>
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: spacing.huge },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, marginBottom: spacing.xxxl },
  stepLabel: { color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.2 },
  headerSpacer: { width: 44 },
  title: { color: colors.paper, fontFamily: fonts.display, fontSize: 42, lineHeight: 48, marginTop: spacing.sm },
  subtitle: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 15, lineHeight: 23, maxWidth: 520, marginTop: spacing.md },
  starterCard: { marginTop: spacing.xxl, padding: spacing.xl, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(215,170,98,0.22)', backgroundColor: colors.surfaceWarm },
  starterBadge: { alignSelf: 'flex-start', backgroundColor: colors.brassSoft, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 5 },
  starterBadgeText: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.1 },
  starterTitle: { color: colors.paper, fontFamily: fonts.display, fontSize: 26, marginTop: spacing.md },
  starterBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginTop: spacing.sm, maxWidth: 520 },
  starterIngredients: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.lg },
  miniChip: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.inkRaised, paddingHorizontal: spacing.md, paddingVertical: 7 },
  miniChipText: { color: colors.paper, fontFamily: fonts.body, fontSize: 11 },
  searchWrap: { marginTop: spacing.xxl, flexDirection: 'row', alignItems: 'center', minHeight: 54, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, paddingHorizontal: spacing.lg },
  searchGlyph: { color: colors.brass, fontFamily: fonts.body, fontSize: 22, marginRight: spacing.md },
  search: { flex: 1, color: colors.paper, fontFamily: fonts.body, fontSize: 14, paddingVertical: spacing.md, outlineStyle: 'none' } as never,
  clearSearch: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 23 },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.md },
  listTitle: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 13 },
  listCount: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 11 },
  ingredientGrid: { gap: spacing.sm },
  ingredientCard: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  ingredientCardSelected: { borderColor: 'rgba(169,214,141,0.34)', backgroundColor: '#172019' },
  ingredientCardOutOfStock: { borderColor: colors.divider, backgroundColor: colors.inkRaised, opacity: 0.88 },
  pressed: { opacity: 0.72 },
  ingredientInitial: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceSoft, alignItems: 'center', justifyContent: 'center' },
  ingredientInitialSelected: { backgroundColor: colors.readyDeep },
  ingredientInitialOutOfStock: { backgroundColor: colors.surfaceSoft },
  ingredientInitialText: { color: colors.brass, fontFamily: fonts.display, fontSize: 18 },
  ingredientInitialTextSelected: { color: colors.ready, fontFamily: fonts.bodyMedium, fontSize: 14 },
  ingredientInitialTextOutOfStock: { color: colors.paperDim },
  ingredientCopy: { flex: 1 },
  ingredientName: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 14 },
  ingredientCategory: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, marginTop: 3 },
  addGlyph: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 18 },
  addGlyphSelected: { color: colors.ready, fontFamily: fonts.bodyMedium, fontSize: 11 },
  restockGlyph: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 11 },
  sectionIntro: { marginTop: spacing.huge },
  sectionTitle: { color: colors.paper, fontFamily: fonts.display, fontSize: 29, marginTop: 4 },
  sectionBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19, marginTop: spacing.sm, maxWidth: 560 },
  staples: { gap: spacing.md, marginTop: spacing.lg },
  stapleCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.lg },
  stapleHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stapleGlyph: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brassSoft, alignItems: 'center', justifyContent: 'center' },
  stapleGlyphText: { color: colors.brass, fontFamily: fonts.body, fontSize: 18 },
  stapleCopy: { flex: 1 },
  stapleTitle: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 14 },
  stapleBody: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, marginTop: 3 },
  segmented: { flexDirection: 'row', backgroundColor: colors.inkRaised, borderRadius: radius.pill, padding: 3 },
  segment: { flex: 1, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentSelected: { backgroundColor: colors.surfaceSoft },
  segmentText: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11 },
  segmentTextSelected: { color: colors.paper, fontFamily: fonts.bodyMedium },
  recommendationPreview: { marginTop: spacing.huge, marginBottom: spacing.lg, minHeight: 82, flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.surfaceWarm, borderWidth: 1, borderColor: 'rgba(215,170,98,0.18)', padding: spacing.lg, gap: spacing.md },
  previewOrb: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brass, alignItems: 'center', justifyContent: 'center' },
  previewOrbText: { color: colors.ink, fontFamily: fonts.display, fontSize: 24 },
  previewCopy: { flex: 1 },
  previewTitle: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 14 },
  previewBody: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, marginTop: 4 },
  previewSpark: { color: colors.brass, fontFamily: fonts.body, fontSize: 18 },
  skipNote: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, textAlign: 'center', marginTop: spacing.md },
  iceRequiredNote: { color: colors.brass },
});
