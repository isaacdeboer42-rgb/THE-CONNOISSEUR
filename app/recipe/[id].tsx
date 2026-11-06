import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IngredientRow } from '@/components/IngredientRow';
import { Button, EmptyState, Eyebrow, IconButton, InlinePill, Screen, ScreenScroll, SectionHeading } from '@/components/ui';
import { archivedRecipeById, ingredientById, recipeById } from '@/data/catalog';
import { categoryLabel, matchRecipe } from '@/domain/matching';
import { ArchivedRecipeId, IngredientId, RecipeId } from '@/domain/types';
import { useBar } from '@/state/BarProvider';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

function RecipeArtwork({ accent }: { accent: string }) {
  return (
    <View style={styles.artwork} accessible={false}>
      <View style={[styles.artHalo, { backgroundColor: accent }]} />
      <View style={styles.artGlass}>
        <View style={[styles.artDrink, { backgroundColor: accent }]} />
        <View style={styles.artFoam} />
      </View>
      <View style={styles.artStem} />
      <View style={styles.artBase} />
      <View style={styles.artPeel} />
      <Text style={styles.artSpark}>✦</Text>
    </View>
  );
}

export default function RecipeDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { snapshot, addShoppingItem, toggleSaved, startMakeSession } = useBar();
  const [servings, setServings] = useState(1);
  const recipeId = Array.isArray(params.id) ? params.id[0] : params.id;
  const recipe = recipeById[recipeId as RecipeId];
  const archived = archivedRecipeById[recipeId as ArchivedRecipeId];
  const match = useMemo(
    () => (recipe ? matchRecipe(recipe, snapshot.inventory, snapshot.basics) : undefined),
    [recipe, snapshot.inventory, snapshot.basics],
  );

  if (archived) {
    const saved = snapshot.savedRecipes.some((item) => item.recipeId === archived.id);
    return (
      <Screen>
        <ScreenScroll>
          <EmptyState
            glyph="—"
            title={`${archived.name} is unavailable`}
            body={archived.reason}
            action={
              saved ? (
                <Button label="Remove saved reference" variant="secondary" onPress={() => toggleSaved(archived.id)} />
              ) : (
                <Button label="Back to Discover" onPress={() => router.replace('/(tabs)/discover')} />
              )
            }
          />
        </ScreenScroll>
      </Screen>
    );
  }

  if (!recipe || !match) {
    return (
      <Screen>
        <ScreenScroll>
          <EmptyState
            glyph="?"
            title="Recipe unavailable"
            body="This recipe may have been withdrawn or the link is no longer valid."
            action={<Button label="Back to Discover" onPress={() => router.replace('/(tabs)/discover')} />}
          />
        </ScreenScroll>
      </Screen>
    );
  }

  const saved = snapshot.savedRecipes.some((item) => item.recipeId === recipe.id);
  const directlyReady = match.category === 'ready' || match.category === 'readyWithSubstitution';

  return (
    <Screen>
      <ScreenScroll contentStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <IconButton label="Go back" glyph="‹" onPress={() => router.back()} />
          <Text style={styles.versionLabel}>REVIEWED · VERSION {recipe.version}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from saved recipes' : 'Save recipe'}
            accessibilityState={{ selected: saved }}
            onPress={() => toggleSaved(recipe.id)}
            style={({ pressed }) => [styles.saveButton, saved && styles.saveButtonActive, pressed && styles.pressed]}
          >
            <Text style={[styles.saveGlyph, saved && styles.saveGlyphActive]}>{saved ? '♥' : '♡'}</Text>
          </Pressable>
        </View>

        <RecipeArtwork accent={recipe.accent} />

        <View style={styles.heroCopy}>
          <InlinePill
            label={categoryLabel(match.category)}
            tone={directlyReady ? 'ready' : match.category === 'oneAway' ? 'attention' : 'neutral'}
          />
          <Text style={styles.eyebrow}>{recipe.eyebrow}</Text>
          <Text accessibilityRole="header" style={styles.title}>{recipe.name}</Text>
          <Text style={styles.description}>{recipe.description}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}><Text style={styles.metaValue}>{recipe.preparationMinutes}</Text><Text style={styles.metaLabel}>MINUTES</Text></View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}><Text style={styles.metaValue}>{recipe.difficulty}</Text><Text style={styles.metaLabel}>METHOD</Text></View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}><Text style={styles.metaValue}>{recipe.steps.length}</Text><Text style={styles.metaLabel}>STEPS</Text></View>
          </View>
        </View>

        <View style={[styles.availabilityPanel, directlyReady && styles.availabilityPanelReady]}>
          <View style={[styles.availabilityIcon, directlyReady && styles.availabilityIconReady]}>
            <Text style={[styles.availabilityGlyph, directlyReady && styles.availabilityGlyphReady]}>{directlyReady ? '✓' : '!'}</Text>
          </View>
          <View style={styles.availabilityCopy}>
            <Text style={styles.availabilityTitle}>{directlyReady ? 'Everything you need is in your bar' : categoryLabel(match.category)}</Text>
            <Text style={styles.availabilityBody}>{match.explanation}</Text>
          </View>
        </View>

        {match.missingRequired.length ? (
          <View style={styles.missingActions}>
            {match.missingRequired.map((ingredientId) => {
              const isBasic = ingredientId === 'standard-ice' || ingredientId === 'large-ice';
              const onShoppingList = snapshot.shoppingItems.some(
                (item) => item.ingredientId === ingredientId,
              );
              return (
                <Button
                  key={ingredientId}
                  label={
                    isBasic
                      ? `Update ${ingredientById[ingredientId].shortName}`
                      : onShoppingList
                        ? `${ingredientById[ingredientId].shortName} is on your list`
                        : `＋ Add ${ingredientById[ingredientId].shortName} to shopping`
                  }
                  variant="secondary"
                  disabled={!isBasic && onShoppingList}
                  onPress={() =>
                    isBasic ? router.push('/setup') : addShoppingItem(ingredientId)
                  }
                />
              );
            })}
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeading
            eyebrow="For the measure"
            title="Ingredients"
            action={
              <View style={styles.stepper} accessibilityRole="adjustable" accessibilityLabel={`${servings} servings`}>
                <Pressable accessibilityRole="button" accessibilityLabel="Decrease servings" disabled={servings === 1} onPress={() => setServings((value) => Math.max(1, value - 1))} style={styles.stepperButton}>
                  <Text style={[styles.stepperGlyph, servings === 1 && styles.disabled]}>−</Text>
                </Pressable>
                <Text style={styles.stepperValue}>{servings}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Increase servings" disabled={servings === 4} onPress={() => setServings((value) => Math.min(4, value + 1))} style={styles.stepperButton}>
                  <Text style={[styles.stepperGlyph, servings === 4 && styles.disabled]}>＋</Text>
                </Pressable>
              </View>
            }
          />
          <View style={styles.ingredientList}>
            {recipe.requirements.map((requirement) => {
              const ingredientId = requirement.alternatives[0] as IngredientId;
              const satisfied = match.satisfied.some((item) => item.requirementId === requirement.id);
              const unconfirmed = match.unconfirmedStaples.includes(ingredientId);
              const status = !requirement.required || requirement.garnish
                ? 'optional'
                : satisfied
                  ? 'onHand'
                  : unconfirmed
                    ? 'unconfirmed'
                    : 'missing';
              return (
                <IngredientRow
                  key={requirement.id}
                  requirement={requirement}
                  status={status}
                  servings={servings}
                  baseServings={recipe.baseServings}
                />
              );
            })}
          </View>
          <Text style={styles.scalingNote}>Non-scalable ice and garnish amounts stay practical as servings change.</Text>
        </View>

        <View style={styles.section}>
          <SectionHeading eyebrow="Before you begin" title="Equipment" />
          <View style={styles.equipmentPanel}>
            <View style={styles.equipmentStatus}>
              <Text style={styles.equipmentStatusGlyph}>?</Text>
              <Text style={styles.equipmentStatusText}>Equipment not checked</Text>
            </View>
            <View style={styles.equipmentList}>
              {recipe.equipment.map((item) => (
                <View key={item} style={styles.equipmentItem}>
                  <Text style={styles.equipmentBullet}>○</Text>
                  <Text style={styles.equipmentName}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading eyebrow="Method preview" title={`${recipe.steps.length} calm steps`} />
          <View style={styles.steps}>
            {recipe.steps.map((step, index) => (
              <View key={step.id} style={styles.stepRow}>
                <Text style={styles.stepNumber}>{String(index + 1).padStart(2, '0')}</Text>
                <View style={styles.stepCopy}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepInstruction}>{step.instruction}</Text>
                </View>
                {step.timerSeconds ? <Text style={styles.timerBadge}>{step.timerSeconds}s</Text> : null}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.sourceNote}>
          <Text style={styles.sourceGlyph}>✦</Text>
          <Text style={styles.sourceText}>{recipe.source} · The open Make session will stay on recipe version {recipe.version}.</Text>
        </View>

        <View style={styles.bottomAction}>
          <Button
            label={directlyReady ? 'Start making' : 'Add missing ingredients first'}
            disabled={!directlyReady}
            onPress={() => {
              const sessionId = startMakeSession(recipe.id, servings);
              router.push(`/make/${sessionId}`);
            }}
          />
          <Text style={styles.bottomNote}>{directlyReady ? 'Progress is saved on this device.' : 'Availability and equipment are kept separate.'}</Text>
        </View>
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: spacing.huge },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, marginBottom: spacing.lg },
  versionLabel: { color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.4 },
  saveButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  saveButtonActive: { backgroundColor: colors.brassSoft, borderColor: 'rgba(215,170,98,0.28)' },
  saveGlyph: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 21 },
  saveGlyphActive: { color: colors.brass },
  pressed: { opacity: 0.72 },
  artwork: { height: 242, overflow: 'hidden', borderRadius: radius.xl, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surfaceWarm, marginBottom: spacing.xxl },
  artHalo: { position: 'absolute', width: 225, height: 225, borderRadius: 113, right: -24, top: 4, opacity: 0.2 },
  artGlass: { position: 'absolute', right: 78, top: 32, width: 124, height: 84, borderWidth: 2, borderColor: 'rgba(244,240,231,0.55)', borderBottomLeftRadius: 62, borderBottomRightRadius: 62, borderTopLeftRadius: 6, borderTopRightRadius: 6, overflow: 'hidden' },
  artDrink: { position: 'absolute', left: 4, right: 4, bottom: 4, height: 47, borderBottomLeftRadius: 56, borderBottomRightRadius: 56, opacity: 0.75 },
  artFoam: { position: 'absolute', left: 5, right: 5, top: 29, height: 8, borderRadius: 4, backgroundColor: 'rgba(244,240,231,0.72)' },
  artStem: { position: 'absolute', right: 139, top: 116, width: 2, height: 63, backgroundColor: 'rgba(244,240,231,0.46)' },
  artBase: { position: 'absolute', right: 98, top: 178, width: 84, height: 2, backgroundColor: 'rgba(244,240,231,0.46)' },
  artPeel: { position: 'absolute', right: 52, top: 38, width: 54, height: 25, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.citrus, transform: [{ rotate: '22deg' }] },
  artSpark: { position: 'absolute', left: 34, bottom: 32, color: colors.brass, fontFamily: fonts.body, fontSize: 20 },
  heroCopy: { alignItems: 'flex-start' },
  eyebrow: { color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.3, textTransform: 'uppercase', marginTop: spacing.lg },
  title: { color: colors.paper, fontFamily: fonts.display, fontSize: 48, lineHeight: 53, marginTop: 5 },
  description: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 16, lineHeight: 24, marginTop: spacing.md, maxWidth: 560 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl },
  metaItem: { minWidth: 72 },
  metaValue: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 13 },
  metaLabel: { color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.2, marginTop: 4 },
  metaDivider: { width: 1, height: 28, backgroundColor: colors.divider, marginHorizontal: spacing.lg },
  availabilityPanel: { marginTop: spacing.xxxl, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(240,161,113,0.22)', backgroundColor: colors.alertDeep, padding: spacing.lg },
  availabilityPanelReady: { borderColor: 'rgba(169,214,141,0.22)', backgroundColor: colors.readyDeep },
  availabilityIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(240,161,113,0.12)', alignItems: 'center', justifyContent: 'center' },
  availabilityIconReady: { backgroundColor: 'rgba(169,214,141,0.12)' },
  availabilityGlyph: { color: colors.alert, fontFamily: fonts.bodyMedium, fontSize: 15 },
  availabilityGlyphReady: { color: colors.ready },
  availabilityCopy: { flex: 1 },
  availabilityTitle: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 13 },
  availabilityBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, marginTop: 4 },
  missingActions: { marginTop: spacing.md, gap: spacing.sm },
  section: { marginTop: spacing.huge, gap: spacing.lg },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, padding: 3 },
  stepperButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  stepperGlyph: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 15 },
  stepperValue: { minWidth: 25, color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 13, textAlign: 'center' },
  disabled: { opacity: 0.25 },
  ingredientList: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  scalingNote: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, lineHeight: 16 },
  equipmentPanel: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, padding: spacing.lg },
  equipmentStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  equipmentStatusGlyph: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.brassSoft, color: colors.brass, textAlign: 'center', lineHeight: 22, fontFamily: fonts.bodyMedium, fontSize: 11 },
  equipmentStatusText: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 11 },
  equipmentList: { marginTop: spacing.md, gap: spacing.md },
  equipmentItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  equipmentBullet: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 13 },
  equipmentName: { color: colors.paper, fontFamily: fonts.body, fontSize: 13 },
  steps: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  stepRow: { minHeight: 100, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  stepNumber: { color: colors.brass, fontFamily: fonts.display, fontSize: 18 },
  stepCopy: { flex: 1 },
  stepTitle: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 13 },
  stepInstruction: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, marginTop: 5 },
  timerBadge: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 11, backgroundColor: colors.brassSoft, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 5 },
  sourceNote: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginTop: spacing.xxxl, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surface },
  sourceGlyph: { color: colors.brass, fontFamily: fonts.body, fontSize: 14 },
  sourceText: { flex: 1, color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, lineHeight: 16 },
  bottomAction: { marginTop: spacing.xxxl },
  bottomNote: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, textAlign: 'center', marginTop: spacing.md },
});
