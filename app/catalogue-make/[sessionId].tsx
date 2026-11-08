import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { isCatalogueRecipeVisible } from '@/catalogue/validation';
import { Button, EmptyState, Eyebrow, IconButton, InlinePill, Screen, ScreenScroll } from '@/components/ui';
import { useCatalogueUserState } from '@/state/CatalogueProvider';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

export default function CatalogueMakeScreen() {
  useKeepAwake('connoisseur-catalogue-make');
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId: string | string[] }>();
  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const { inventory, makeSessions, addRecipeIngredients, updateMakeSession } = useCatalogueUserState();
  const session = makeSessions.find((item) => item.id === sessionId);

  if (!session || !isCatalogueRecipeVisible(session.recipe)) {
    return (
      <Screen>
        <ScreenScroll>
          <EmptyState
            glyph="!"
            title="Make session unavailable"
            body="The saved community recipe snapshot could not be restored or no longer meets the catalogue completeness gate."
            action={<Button label="Back to Discover" onPress={() => router.replace('/(tabs)/discover')} />}
          />
        </ScreenScroll>
      </Screen>
    );
  }

  const { recipe } = session;
  const onHand = new Set(inventory.filter((item) => item.status === 'onHand').map((item) => item.ingredientId));
  const missing = recipe.ingredients.filter((ingredient) => !onHand.has(ingredient.ingredientId));

  if (session.completedAt) {
    return (
      <Screen>
        <ScreenScroll contentStyle={styles.centered}>
          <View style={styles.completeMark}><Text style={styles.completeMarkText}>✓</Text></View>
          <Eyebrow>Reference make complete</Eyebrow>
          <Text accessibilityRole="header" style={styles.completeTitle}>{recipe.name}</Text>
          <Text style={styles.body}>The recipe remains attributed to its upstream source and has not been promoted into the reviewed Connoisseur collection.</Text>
          <Button label="Done" onPress={() => router.replace('/(tabs)/discover')} />
        </ScreenScroll>
      </Screen>
    );
  }

  if (session.stepIndex < 0) {
    return (
      <Screen>
        <ScreenScroll>
          <View style={styles.topBar}>
            <IconButton label="Exit Make mode" glyph="×" onPress={() => router.back()} />
            <Text style={styles.saved}>SNAPSHOT SAVED</Text>
            <View style={styles.spacer} />
          </View>
          <Eyebrow>Community reference</Eyebrow>
          <Text accessibilityRole="header" style={styles.title}>Set up {recipe.name}.</Text>
          <Text style={styles.body}>This is a one-step reference make from the upstream instructions. Confirm the source and use your judgement before pouring.</Text>

          <View style={styles.warning}>
            <Text style={styles.warningTitle}>Not editorially confirmed</Text>
            <Text style={styles.warningBody}>The automated audit checked structure, quantities and units. It cannot verify taste, source rights, safe serving assumptions or factual accuracy.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Ingredients</Text>
              <InlinePill label={missing.length ? `${missing.length} missing` : 'All on hand'} tone={missing.length ? 'attention' : 'ready'} />
            </View>
            {recipe.ingredients.map((ingredient, index) => {
              const measure = [ingredient.amount, ingredient.unitAbbreviation || ingredient.unitName].filter(Boolean).join(' ');
              const available = onHand.has(ingredient.ingredientId);
              return (
                <View key={`${ingredient.ingredientId}-${index}`} style={styles.row}>
                  <Text style={styles.measure}>{measure}</Text>
                  <Text style={styles.ingredient}>{ingredient.fullName || ingredient.ingredientName}</Text>
                  <Text style={[styles.status, available && styles.statusReady]}>{available ? 'ON HAND' : 'MISSING'}</Text>
                </View>
              );
            })}
            {missing.length ? (
              <Button label="Add named ingredients to My Bar" variant="secondary" onPress={() => addRecipeIngredients(recipe)} />
            ) : null}
          </View>

          <Button label="Begin instructions" onPress={() => updateMakeSession(session.id, { stepIndex: 0 })} />
        </ScreenScroll>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenScroll>
        <View style={styles.topBar}>
          <IconButton label="Exit Make mode; progress is saved" glyph="×" onPress={() => router.back()} />
          <Text style={styles.saved}>COMMUNITY REFERENCE · STEP 1 OF 1</Text>
          <View style={styles.spacer} />
        </View>
        <Eyebrow>{recipe.name}</Eyebrow>
        <Text accessibilityRole="header" style={styles.title}>Follow the source method.</Text>
        <View style={styles.instructionCard}>
          <Text style={styles.instruction}>{recipe.instructions}</Text>
        </View>
        <Text style={styles.source}>Source: {recipe.source || recipe.sourceUrl || 'Community catalogue record'}</Text>
        <Button label="Complete make" onPress={() => updateMakeSession(session.id, { completedAt: new Date().toISOString() })} />
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, marginBottom: spacing.xxxl },
  saved: { flex: 1, color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 10, letterSpacing: 1.1, textAlign: 'center' },
  spacer: { width: 44 },
  title: { color: colors.paper, fontFamily: fonts.display, fontSize: 40, lineHeight: 46, marginTop: spacing.sm },
  body: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 22, marginTop: spacing.md, marginBottom: spacing.xl },
  warning: { gap: spacing.sm, padding: spacing.lg, marginBottom: spacing.xl, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(240,161,113,0.28)', backgroundColor: colors.alertDeep },
  warningTitle: { color: colors.alert, fontFamily: fonts.bodyMedium, fontSize: 13 },
  warningBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 11, lineHeight: 17 },
  card: { gap: spacing.md, padding: spacing.xl, marginBottom: spacing.xl, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  cardTitle: { color: colors.paper, fontFamily: fonts.display, fontSize: 25 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  measure: { width: 72, color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 11 },
  ingredient: { flex: 1, color: colors.paper, fontFamily: fonts.body, fontSize: 12 },
  status: { color: colors.alert, fontFamily: fonts.bodyMedium, fontSize: 9, letterSpacing: 0.8 },
  statusReady: { color: colors.ready },
  instructionCard: { padding: spacing.xl, marginTop: spacing.xxl, marginBottom: spacing.lg, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
  instruction: { color: colors.paper, fontFamily: fonts.body, fontSize: 19, lineHeight: 30 },
  source: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, lineHeight: 17, marginBottom: spacing.xl },
  centered: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  completeMark: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.readyDeep, borderWidth: 1, borderColor: colors.ready },
  completeMarkText: { color: colors.ready, fontFamily: fonts.display, fontSize: 32 },
  completeTitle: { color: colors.paper, fontFamily: fonts.display, fontSize: 42, textAlign: 'center' },
});
