import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecipeCard } from '@/components/RecipeCard';
import { Button, ConnoisseurMark, EmptyState, Eyebrow, IconButton, Screen, ScreenScroll, SectionHeading } from '@/components/ui';
import { ingredientById, ingredients } from '@/data/catalog';
import { IngredientId, MatchResult } from '@/domain/types';
import { useBar } from '@/state/BarProvider';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

function IngredientModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { snapshot, addIngredient } = useBar();
  const [query, setQuery] = useState('');
  const owned = new Set(snapshot.inventory.filter((item) => item.status === 'onHand').map((item) => item.ingredientId));
  const choices = ingredients.filter((ingredient) => {
    if (ingredient.isStaple || ingredient.id === 'orange-peel' || owned.has(ingredient.id)) return false;
    const haystack = `${ingredient.name} ${ingredient.aliases.join(' ')}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalScrim}>
        <Pressable accessibilityLabel="Close ingredient picker" style={StyleSheet.absoluteFill} onPress={onClose} />
        <SafeAreaView style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <View>
              <Eyebrow>My bar</Eyebrow>
              <Text accessibilityRole="header" style={styles.sheetTitle}>Add an ingredient</Text>
            </View>
            <IconButton label="Close" glyph="×" onPress={onClose} />
          </View>
          <View style={styles.sheetSearchWrap}>
            <Text style={styles.sheetSearchGlyph}>⌕</Text>
            <TextInput
              autoFocus
              accessibilityLabel="Search ingredients to add"
              value={query}
              onChangeText={setQuery}
              placeholder="Try lemon or bitters"
              placeholderTextColor={colors.paperDim}
              style={styles.sheetSearch}
            />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.sheetList}>
            {choices.map((ingredient) => (
              <Pressable
                key={ingredient.id}
                accessibilityRole="button"
                accessibilityLabel={`Add ${ingredient.name}`}
                onPress={() => {
                  addIngredient(ingredient.id);
                  onClose();
                  setQuery('');
                }}
                style={({ pressed }) => [styles.sheetResult, pressed && styles.pressed]}
              >
                <View style={styles.resultInitial}><Text style={styles.resultInitialText}>{ingredient.shortName.charAt(0)}</Text></View>
                <View style={styles.resultCopy}>
                  <Text style={styles.resultName}>{ingredient.name}</Text>
                  <Text style={styles.resultCategory}>{ingredient.category}</Text>
                </View>
                <Text style={styles.resultAdd}>＋ Add</Text>
              </Pressable>
            ))}
            {choices.length === 0 ? (
              <Text style={styles.noResults}>No unowned ingredients match “{query}”.</Text>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function QuickSelectModal({
  match,
  empty,
  saved,
  onClose,
  onPickAgain,
  onExpand,
  onSave,
}: {
  match?: MatchResult;
  empty: boolean;
  saved: boolean;
  onClose: () => void;
  onPickAgain: () => void;
  onExpand: () => void;
  onSave: () => void;
}) {
  const router = useRouter();
  return (
    <Modal visible={Boolean(match) || empty} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.quickScrim}>
        <View style={styles.quickCard}>
          <Text style={styles.quickSpark}>✦</Text>
          {empty ? (
            <>
              <Eyebrow>No direct-ready match</Eyebrow>
              <Text accessibilityRole="header" style={styles.quickTitle}>Open the shortlist?</Text>
              <Text style={styles.quickBody}>Nothing is ready with your current bar. You can deliberately include drinks that need one more ingredient.</Text>
              <View style={styles.quickActions}>
                <Button label="Include one-away drinks" onPress={onExpand} />
                <Button label="Not now" variant="ghost" onPress={onClose} />
              </View>
            </>
          ) : (
            <>
              <Eyebrow>Chosen for tonight</Eyebrow>
              <Text accessibilityRole="header" style={styles.quickTitle}>{match?.recipe.name}</Text>
              <Text style={styles.quickBody}>{match?.explanation}</Text>
              <View style={styles.quickActions}>
                <Button
                  label="Make this"
                  onPress={() => {
                    onClose();
                    if (match) router.push(`/recipe/${match.recipe.id}`);
                  }}
                />
                <Button
                  label={saved ? 'Saved' : 'Save for later'}
                  variant="secondary"
                  disabled={saved}
                  onPress={onSave}
                />
                <Button label="Pick again" variant="ghost" onPress={onPickAgain} />
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default function TonightScreen() {
  const router = useRouter();
  const {
    mode,
    snapshot,
    recommendations,
    addIngredient,
    chooseQuickRecipe,
    setSessionPreference,
    clearSessionPreferences,
    toggleSaved,
  } = useBar();
  const [ingredientModalOpen, setIngredientModalOpen] = useState(false);
  const [quickPick, setQuickPick] = useState<MatchResult>();
  const [quickEmpty, setQuickEmpty] = useState(false);
  const inventoryCount = snapshot.inventory.filter((item) => item.status === 'onHand').length;
  const ready = recommendations.filter((match) => match.category === 'ready' || match.category === 'readyWithSubstitution');
  const nearly = recommendations.filter((match) => match.category === 'oneAway');
  const explore = recommendations.filter((match) => match.category === 'moreToExplore');
  const firstMatch = ready[0] ?? nearly[0] ?? explore[0];

  const preferenceOptions = [
    { dimension: 'sour' as const, label: 'Bright & sour', value: { intensity: 0.82, importance: 0.85 } },
    { dimension: 'sweet' as const, label: 'Not too sweet', value: { intensity: 0.22, importance: 0.8 } },
    { dimension: 'spiritForward' as const, label: 'Spirit-forward', value: { intensity: 0.9, importance: 0.85 } },
  ];

  const pickQuick = (allowOneAway = false) => {
    const selected = chooseQuickRecipe(allowOneAway);
    setQuickEmpty(!selected);
    setQuickPick(selected);
  };

  return (
    <Screen>
      <ScreenScroll>
        <View style={styles.header}>
          <View>
            <Eyebrow>Tonight at your place</Eyebrow>
            <Text accessibilityRole="header" style={styles.title}>What shall we make?</Text>
          </View>
          <ConnoisseurMark compact />
        </View>

        {mode === 'sample' ? (
          <View style={styles.sampleBanner}>
            <Text style={styles.sampleGlyph}>◎</Text>
            <View style={styles.sampleCopy}>
              <Text style={styles.sampleTitle}>Exploring a sample bar</Text>
              <Text style={styles.sampleBody}>These demo ingredients are separate from your own bar.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace('/')}
              hitSlop={8}
            >
              <Text style={styles.sampleAction}>Exit</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.barSummary}>
          <View style={styles.bottleCluster} accessible={false}>
            <View style={styles.bottleTall} />
            <View style={styles.bottleShort} />
            <View style={styles.bottleRound} />
          </View>
          <View style={styles.barSummaryCopy}>
            <Text style={styles.barLabel}>YOUR BAR</Text>
            <Text style={styles.barValue}>{inventoryCount} {inventoryCount === 1 ? 'ingredient' : 'ingredients'} on hand</Text>
            <Text style={styles.barMeta}>{ready.length} ready now · {nearly.length} nearly there</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add an ingredient"
            onPress={() => setIngredientModalOpen(true)}
            style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
          >
            <Text style={styles.addButtonText}>＋ Add</Text>
          </Pressable>
        </View>

        <View style={styles.preferenceSection}>
          <View style={styles.preferenceHeader}>
            <Text style={styles.preferenceLabel}>I FEEL LIKE</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/preferences')}>
              <Text style={styles.preferenceNote}>Edit permanent profile →</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {preferenceOptions.map((option) => {
              const active = Boolean(snapshot.sessionPreferences.tastes[option.dimension]);
              return (
                <Pressable
                  key={option.label}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  onPress={() =>
                    setSessionPreference(option.dimension, active ? undefined : option.value)
                  }
                  style={[styles.preferenceChip, active && styles.preferenceChipActive]}
                >
                  <Text style={[styles.preferenceChipText, active && styles.preferenceChipTextActive]}>{active ? '✓ ' : ''}{option.label}</Text>
                </Pressable>
              );
            })}
            {Object.keys(snapshot.sessionPreferences.tastes).length ? (
              <Pressable
                accessibilityRole="button"
                onPress={clearSessionPreferences}
                style={styles.clearChip}
              >
                <Text style={styles.clearChipText}>Clear tonight</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>

        {mode === 'guest' && inventoryCount > 0 ? (
          <View style={styles.accountBanner}>
            <View style={styles.accountBannerCopy}>
              <Text style={styles.accountBannerTitle}>Keep this bar beyond one device</Text>
              <Text style={styles.accountBannerBody}>Create an account after you have explored your recommendations. Your guest data stays intact until the import is confirmed.</Text>
            </View>
            <Button label="Back up my bar" variant="secondary" onPress={() => router.push('/account/register')} />
          </View>
        ) : null}

        {inventoryCount === 0 ? (
          <EmptyState
            glyph="◇"
            title="Your first recommendation starts with one ingredient"
            body="Add what is closest to hand. You do not need to catalogue the whole shelf before seeing useful matches."
            action={<Button label="Build my bar" onPress={() => router.push('/setup')} />}
          />
        ) : (
          <>
            <View style={styles.sectionGap}>
              <SectionHeading
                eyebrow={ready.length ? 'Ready now' : 'Best next move'}
                title={ready.length ? `${ready.length} ${ready.length === 1 ? 'drink' : 'drinks'} you can make` : 'You’re close to something good'}
                action={<Text style={styles.sectionCount}>{String(ready.length || nearly.length).padStart(2, '0')}</Text>}
              />
            </View>

            {firstMatch ? (
              <RecipeCard
                match={firstMatch}
                featured
                onPress={() => router.push(`/recipe/${firstMatch.recipe.id}`)}
                onQuickAdd={(ingredientId) => addIngredient(ingredientId)}
              />
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose a cocktail for me"
              onPress={() => pickQuick(false)}
              style={({ pressed }) => [styles.quickSelect, pressed && styles.pressed]}
            >
              <View style={styles.quickSelectGlyph}><Text style={styles.quickSelectGlyphText}>✦</Text></View>
              <View style={styles.quickSelectCopy}>
                <Text style={styles.quickSelectTitle}>Choose for me</Text>
                <Text style={styles.quickSelectBody}>A thoughtful pick from your current matches</Text>
              </View>
              <Text style={styles.quickSelectArrow}>→</Text>
            </Pressable>

            {(ready.length > 1 || (ready.length > 0 && nearly.length > 0)) ? (
              <View style={styles.group}>
                <SectionHeading eyebrow="Within reach" title="More good options" />
                <View style={styles.cardList}>
                  {[...ready.slice(1), ...nearly].map((match) => (
                    <RecipeCard
                      key={match.recipe.id}
                      match={match}
                      onPress={() => router.push(`/recipe/${match.recipe.id}`)}
                      onQuickAdd={addIngredient}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {ready.length === 0 && nearly.length > 1 ? (
              <View style={styles.group}>
                <SectionHeading eyebrow="One ingredient away" title="Worth a small addition" />
                <View style={styles.cardList}>
                  {nearly.slice(1).map((match) => (
                    <RecipeCard key={match.recipe.id} match={match} onPress={() => router.push(`/recipe/${match.recipe.id}`)} onQuickAdd={addIngredient} />
                  ))}
                </View>
              </View>
            ) : null}

            {explore.length ? (
              <View style={styles.group}>
                <SectionHeading eyebrow="More to explore" title="A little further down the shelf" />
                <View style={styles.cardList}>
                  {explore.map((match) => (
                    <RecipeCard key={match.recipe.id} match={match} onPress={() => router.push(`/recipe/${match.recipe.id}`)} />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScreenScroll>

      <IngredientModal visible={ingredientModalOpen} onClose={() => setIngredientModalOpen(false)} />
      <QuickSelectModal
        match={quickPick}
        empty={quickEmpty}
        saved={Boolean(quickPick && snapshot.savedRecipes.some((item) => item.recipeId === quickPick.recipe.id))}
        onClose={() => {
          setQuickPick(undefined);
          setQuickEmpty(false);
        }}
        onPickAgain={() => pickQuick(false)}
        onExpand={() => pickQuick(true)}
        onSave={() => {
          if (quickPick) toggleSaved(quickPick.recipe.id);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg, paddingTop: spacing.md, marginBottom: spacing.xl },
  title: { color: colors.paper, fontFamily: fonts.display, fontSize: 34, lineHeight: 40, marginTop: 3 },
  sampleBanner: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(215,170,98,0.22)', backgroundColor: colors.brassSoft, padding: spacing.md, gap: spacing.md, marginBottom: spacing.md },
  sampleGlyph: { color: colors.brass, fontFamily: fonts.body, fontSize: 18 },
  sampleCopy: { flex: 1 },
  sampleTitle: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 12 },
  sampleBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 10, marginTop: 2 },
  sampleAction: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 11 },
  barSummary: { minHeight: 102, flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.lg },
  bottleCluster: { width: 54, height: 58 },
  bottleTall: { position: 'absolute', left: 16, bottom: 0, width: 17, height: 52, borderRadius: 5, borderWidth: 1, borderColor: colors.brass, backgroundColor: colors.brassSoft },
  bottleShort: { position: 'absolute', left: 0, bottom: 0, width: 20, height: 38, borderRadius: 4, borderWidth: 1, borderColor: colors.paperDim, backgroundColor: colors.surfaceSoft },
  bottleRound: { position: 'absolute', right: 0, bottom: 0, width: 23, height: 31, borderRadius: 10, borderWidth: 1, borderColor: colors.alert, backgroundColor: colors.alertDeep },
  barSummaryCopy: { flex: 1 },
  barLabel: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 8, letterSpacing: 1.4 },
  barValue: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 14, marginTop: 5 },
  barMeta: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 10, marginTop: 4 },
  addButton: { minHeight: 40, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.brassSoft, alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 11 },
  preferenceSection: { marginTop: spacing.xl, marginBottom: spacing.xxxl },
  preferenceHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md },
  preferenceLabel: { color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 9, letterSpacing: 1.4 },
  preferenceNote: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 10 },
  chips: { gap: spacing.sm, paddingRight: spacing.xl },
  preferenceChip: { minHeight: 38, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  preferenceChipActive: { borderColor: 'rgba(215,170,98,0.34)', backgroundColor: colors.brassSoft },
  preferenceChipText: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 11 },
  preferenceChipTextActive: { color: colors.brass, fontFamily: fonts.bodyMedium },
  clearChip: { minHeight: 38, paddingHorizontal: spacing.md, justifyContent: 'center' },
  clearChipText: { color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 10 },
  accountBanner: { marginBottom: spacing.xxl, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(215,170,98,0.2)', backgroundColor: colors.surfaceWarm, padding: spacing.lg, gap: spacing.lg },
  accountBannerCopy: { gap: 4 },
  accountBannerTitle: { color: colors.paper, fontFamily: fonts.display, fontSize: 21 },
  accountBannerBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 11, lineHeight: 17 },
  sectionGap: { marginBottom: spacing.lg },
  sectionCount: { color: colors.paperDim, fontFamily: fonts.display, fontSize: 25 },
  quickSelect: { minHeight: 78, marginTop: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(215,170,98,0.2)', backgroundColor: colors.surfaceWarm, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  quickSelectGlyph: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.brass, alignItems: 'center', justifyContent: 'center' },
  quickSelectGlyphText: { color: colors.ink, fontFamily: fonts.body, fontSize: 17 },
  quickSelectCopy: { flex: 1 },
  quickSelectTitle: { color: colors.paper, fontFamily: fonts.display, fontSize: 20 },
  quickSelectBody: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 10, marginTop: 3 },
  quickSelectArrow: { color: colors.brass, fontFamily: fonts.body, fontSize: 21 },
  group: { marginTop: spacing.huge, gap: spacing.lg },
  cardList: { gap: spacing.md },
  pressed: { opacity: 0.72 },
  modalScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.64)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '82%', minHeight: '58%', backgroundColor: colors.inkRaised, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: colors.divider, paddingHorizontal: spacing.xl },
  sheetHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: colors.paperDim, opacity: 0.45, alignSelf: 'center', marginTop: spacing.md },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl },
  sheetTitle: { color: colors.paper, fontFamily: fonts.display, fontSize: 29, marginTop: 3 },
  sheetSearchWrap: { minHeight: 52, marginTop: spacing.xl, flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, gap: spacing.md },
  sheetSearchGlyph: { color: colors.brass, fontFamily: fonts.body, fontSize: 20 },
  sheetSearch: { flex: 1, color: colors.paper, fontFamily: fonts.body, fontSize: 14 },
  sheetList: { marginTop: spacing.md },
  sheetResult: { minHeight: 70, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider, gap: spacing.md },
  resultInitial: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brassSoft, alignItems: 'center', justifyContent: 'center' },
  resultInitialText: { color: colors.brass, fontFamily: fonts.display, fontSize: 18 },
  resultCopy: { flex: 1 },
  resultName: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 13 },
  resultCategory: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 10, marginTop: 3 },
  resultAdd: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 11 },
  noResults: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 13, textAlign: 'center', paddingVertical: spacing.xxxl },
  quickScrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  quickCard: { width: '100%', maxWidth: 440, borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(215,170,98,0.25)', backgroundColor: colors.surfaceWarm, padding: spacing.xxxl, alignItems: 'center' },
  quickSpark: { color: colors.brass, fontSize: 28, marginBottom: spacing.lg },
  quickTitle: { color: colors.paper, fontFamily: fonts.display, fontSize: 37, lineHeight: 43, textAlign: 'center', marginTop: spacing.sm },
  quickBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: spacing.md },
  quickActions: { width: '100%', gap: spacing.sm, marginTop: spacing.xxl },
});
