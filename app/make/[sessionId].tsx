import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { IngredientRow } from '@/components/IngredientRow';
import { Button, EmptyState, Eyebrow, IconButton, Screen, ScreenScroll } from '@/components/ui';
import { recipeById } from '@/data/catalog';
import { matchRecipe } from '@/domain/matching';
import { IngredientId } from '@/domain/types';
import { useBar } from '@/state/BarProvider';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export default function MakeModeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId: string }>();
  const { snapshot, updateMakeSession } = useBar();
  const [clock, setClock] = useState(Date.now());
  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const session = snapshot.makeSessions.find((item) => item.id === sessionId);
  const recipe = session ? recipeById[session.recipeId] : undefined;
  const match = useMemo(
    () => (recipe ? matchRecipe(recipe, snapshot.inventory, snapshot.basics) : undefined),
    [recipe, snapshot.inventory, snapshot.basics],
  );

  useEffect(() => {
    if (!session?.timerTarget) return;
    const interval = setInterval(() => setClock(Date.now()), 250);
    return () => clearInterval(interval);
  }, [session?.timerTarget]);

  if (!session || !recipe || !match || session.recipeVersionId !== recipe.versionId) {
    return (
      <Screen>
        <ScreenScroll>
          <EmptyState
            glyph="!"
            title="Make session unavailable"
            body="The pinned recipe version could not be restored. Your inventory has not been changed."
            action={<Button label="Back to Tonight" onPress={() => router.replace('/(tabs)/tonight')} />}
          />
        </ScreenScroll>
      </Screen>
    );
  }

  const currentStep = session.stepIndex >= 0 ? recipe.steps[session.stepIndex] : undefined;
  const timerRemaining = session.timerTarget
    ? Math.max(0, Math.ceil((new Date(session.timerTarget).getTime() - clock) / 1000))
    : undefined;

  if (session.completedAt) {
    return (
      <Screen>
        <ScreenScroll contentStyle={styles.completionScroll}>
          <View style={styles.completionMark}><Text style={styles.completionMarkText}>✓</Text></View>
          <Eyebrow>Drink complete</Eyebrow>
          <Text accessibilityRole="header" style={styles.completionTitle}>Nicely done.</Text>
          <Text style={styles.completionDrink}>{recipe.name}</Text>
          <Text style={styles.completionBody}>Your bar has not been depleted. If anything ran out, you can mark it later from My Bar.</Text>
          <View style={styles.feedbackCard}>
            <Text style={styles.feedbackTitle}>How was it?</Text>
            <Text style={styles.feedbackBody}>Private feedback is stored with this session for your own history.</Text>
            <View style={styles.feedbackButtons}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: session.feedback === 'liked' }}
                onPress={() => updateMakeSession(session.id, { feedback: 'liked' })}
                style={[styles.feedbackButton, session.feedback === 'liked' && styles.feedbackButtonActive]}
              >
                <Text style={[styles.feedbackButtonText, session.feedback === 'liked' && styles.feedbackButtonTextActive]}>♥ Liked it</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: session.feedback === 'notForMe' }}
                onPress={() => updateMakeSession(session.id, { feedback: 'notForMe' })}
                style={[styles.feedbackButton, session.feedback === 'notForMe' && styles.feedbackButtonActive]}
              >
                <Text style={[styles.feedbackButtonText, session.feedback === 'notForMe' && styles.feedbackButtonTextActive]}>Not for me</Text>
              </Pressable>
            </View>
          </View>
          <Button label="Done for tonight" onPress={() => router.replace('/(tabs)/tonight')} />
        </ScreenScroll>
      </Screen>
    );
  }

  if (session.stepIndex < 0) {
    return (
      <Screen>
        <ScreenScroll contentStyle={styles.preflightScroll}>
          <View style={styles.makeHeader}>
            <IconButton label="Exit Make mode; progress is saved" glyph="×" onPress={() => router.back()} />
            <Text style={styles.savedLabel}>PROGRESS SAVED</Text>
            <View style={styles.headerSpacer} />
          </View>
          <Eyebrow>Before the first pour</Eyebrow>
          <Text accessibilityRole="header" style={styles.preflightTitle}>Set up for a smooth make.</Text>
          <Text style={styles.preflightBody}>{session.servings} {session.servings === 1 ? 'serving' : 'servings'} · Recipe version {recipe.version} · About {recipe.preparationMinutes} minutes</Text>

          <View style={styles.preflightCard}>
            <Text style={styles.preflightSectionTitle}>Ingredients</Text>
            {recipe.requirements.map((requirement) => {
              const ingredientId = requirement.alternatives[0] as IngredientId;
              const satisfied = match.satisfied.some((item) => item.requirementId === requirement.id);
              const unconfirmed = match.unconfirmedStaples.includes(ingredientId);
              const status = !requirement.required || requirement.garnish ? 'optional' : satisfied ? 'onHand' : unconfirmed ? 'unconfirmed' : 'missing';
              return <IngredientRow key={requirement.id} requirement={requirement} status={status} servings={session.servings} baseServings={recipe.baseServings} />;
            })}
          </View>

          <View style={styles.preflightCard}>
            <Text style={styles.preflightSectionTitle}>Equipment</Text>
            <View style={styles.equipmentGrid}>
              {recipe.equipment.map((item) => (
                <View key={item} style={styles.equipmentItem}><Text style={styles.equipmentGlyph}>○</Text><Text style={styles.equipmentText}>{item}</Text></View>
              ))}
            </View>
          </View>

          <Button label="Begin step 1" onPress={() => updateMakeSession(session.id, { stepIndex: 0 })} />
          <Text style={styles.savedHint}>You can leave at any time. This session resumes on the same step.</Text>
        </ScreenScroll>
      </Screen>
    );
  }

  const lastStep = session.stepIndex === recipe.steps.length - 1;
  const progress = (session.stepIndex + 1) / recipe.steps.length;

  return (
    <Screen>
      <View style={styles.stepScreen}>
        <View style={styles.stepTopBar}>
          <IconButton label="Exit Make mode; progress is saved" glyph="×" onPress={() => router.back()} />
          <View style={styles.progressCopy}>
            <Text style={styles.stepOf}>STEP {session.stepIndex + 1} OF {recipe.steps.length}</Text>
            <Text style={styles.recipeName}>{recipe.name}</Text>
          </View>
          <Text style={styles.servings}>{session.servings}×</Text>
        </View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View>

        <View style={styles.stepContent}>
          <Text style={styles.stepNumber}>{String(session.stepIndex + 1).padStart(2, '0')}</Text>
          <Text accessibilityRole="header" style={styles.stepTitle}>{currentStep?.title}</Text>
          <Text style={styles.stepInstruction}>{currentStep?.instruction}</Text>

          {currentStep?.tip ? (
            <View style={styles.tipCard}>
              <Text style={styles.tipGlyph}>✦</Text>
              <Text style={styles.tipText}>{currentStep.tip}</Text>
            </View>
          ) : null}

          {currentStep?.timerSeconds ? (
            <View style={[styles.timerCard, timerRemaining === 0 && styles.timerCardComplete]} accessibilityLiveRegion="polite">
              <View>
                <Text style={styles.timerLabel}>{timerRemaining === 0 ? 'TIMER COMPLETE' : 'OPTIONAL TIMER'}</Text>
                <Text style={styles.timerValue}>{formatTimer(timerRemaining ?? currentStep.timerSeconds)}</Text>
              </View>
              {!session.timerTarget ? (
                <Button
                  label="Start"
                  variant="secondary"
                  style={styles.timerButton}
                  onPress={() =>
                    updateMakeSession(session.id, {
                      timerTarget: new Date(Date.now() + currentStep.timerSeconds! * 1000).toISOString(),
                      timerStepId: currentStep.id,
                    })
                  }
                />
              ) : (
                <Button
                  label={timerRemaining === 0 ? 'Clear' : 'Cancel'}
                  variant="ghost"
                  style={styles.timerButton}
                  onPress={() => updateMakeSession(session.id, { timerTarget: undefined, timerStepId: undefined })}
                />
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.stepFooter}>
          {session.stepIndex > 0 ? (
            <Button
              label="Previous"
              variant="ghost"
              style={styles.previousButton}
              onPress={() => updateMakeSession(session.id, { stepIndex: session.stepIndex - 1, timerTarget: undefined, timerStepId: undefined })}
            />
          ) : null}
          <Button
            label={lastStep ? 'Finish drink' : 'Next step'}
            style={styles.nextButton}
            onPress={() => {
              if (lastStep) {
                updateMakeSession(session.id, { completedAt: new Date().toISOString(), timerTarget: undefined, timerStepId: undefined });
              } else {
                updateMakeSession(session.id, { stepIndex: session.stepIndex + 1, timerTarget: undefined, timerStepId: undefined });
              }
            }}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  completionScroll: { justifyContent: 'center', paddingBottom: spacing.huge },
  completionMark: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.readyDeep, borderWidth: 1, borderColor: 'rgba(169,214,141,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xl },
  completionMarkText: { color: colors.ready, fontFamily: fonts.bodyMedium, fontSize: 24 },
  completionTitle: { color: colors.paper, fontFamily: fonts.display, fontSize: 48, lineHeight: 54, marginTop: spacing.sm },
  completionDrink: { color: colors.brass, fontFamily: fonts.display, fontSize: 26, marginTop: spacing.sm },
  completionBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, maxWidth: 520, marginTop: spacing.lg },
  feedbackCard: { marginVertical: spacing.xxxl, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, padding: spacing.xl },
  feedbackTitle: { color: colors.paper, fontFamily: fonts.display, fontSize: 26 },
  feedbackBody: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, marginTop: spacing.sm },
  feedbackButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  feedbackButton: { flex: 1, minHeight: 48, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.divider, alignItems: 'center', justifyContent: 'center' },
  feedbackButtonActive: { backgroundColor: colors.brassSoft, borderColor: 'rgba(215,170,98,0.3)' },
  feedbackButtonText: { color: colors.paperMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  feedbackButtonTextActive: { color: colors.brass },
  preflightScroll: { paddingBottom: spacing.huge },
  makeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, marginBottom: spacing.xxxl },
  savedLabel: { color: colors.ready, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.3 },
  headerSpacer: { width: 44 },
  preflightTitle: { color: colors.paper, fontFamily: fonts.display, fontSize: 42, lineHeight: 48, marginTop: spacing.sm },
  preflightBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 13, marginTop: spacing.md },
  preflightCard: { marginTop: spacing.xxl, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, padding: spacing.lg },
  preflightSectionTitle: { color: colors.paper, fontFamily: fonts.display, fontSize: 23, marginBottom: spacing.md },
  equipmentGrid: { gap: spacing.md },
  equipmentItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  equipmentGlyph: { color: colors.brass, fontFamily: fonts.body, fontSize: 13 },
  equipmentText: { color: colors.paper, fontFamily: fonts.body, fontSize: 13 },
  savedHint: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, textAlign: 'center', marginTop: spacing.md },
  stepScreen: { flex: 1, width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: spacing.xl },
  stepTopBar: { flexDirection: 'row', alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.lg },
  progressCopy: { flex: 1, alignItems: 'center' },
  stepOf: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.3 },
  recipeName: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 11, marginTop: 3 },
  servings: { width: 44, color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 11, textAlign: 'right' },
  progressTrack: { height: 2, backgroundColor: colors.surfaceSoft },
  progressFill: { height: 2, backgroundColor: colors.brass },
  stepContent: { flex: 1, justifyContent: 'center', paddingVertical: spacing.xxxl },
  stepNumber: { color: colors.brass, fontFamily: fonts.display, fontSize: 22 },
  stepTitle: { color: colors.paper, fontFamily: fonts.display, fontSize: 44, lineHeight: 49, marginTop: spacing.sm },
  stepInstruction: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 18, lineHeight: 28, maxWidth: 610, marginTop: spacing.xl },
  tipCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, maxWidth: 610, borderRadius: radius.lg, backgroundColor: colors.surface, padding: spacing.lg, marginTop: spacing.xxl },
  tipGlyph: { color: colors.brass, fontFamily: fonts.body, fontSize: 14 },
  tipText: { flex: 1, color: colors.paperMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  timerCard: { maxWidth: 610, minHeight: 100, marginTop: spacing.xxl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(215,170,98,0.25)', backgroundColor: colors.surfaceWarm, padding: spacing.lg },
  timerCardComplete: { borderColor: 'rgba(169,214,141,0.3)', backgroundColor: colors.readyDeep },
  timerLabel: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.3 },
  timerValue: { color: colors.paper, fontFamily: fonts.display, fontSize: 33, marginTop: 2 },
  timerButton: { minWidth: 92, minHeight: 44 },
  stepFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.lg },
  previousButton: { flex: 0.45 },
  nextButton: { flex: 1 },
});
