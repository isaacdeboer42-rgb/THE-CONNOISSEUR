import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ingredientById } from '@/data/catalog';
import { categoryLabel } from '@/domain/matching';
import { IngredientId, MatchResult } from '@/domain/types';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

import { InlinePill } from './ui';

export function RecipeCard({
  match,
  onPress,
  onQuickAdd,
  featured = false,
}: {
  match: MatchResult;
  onPress: () => void;
  onQuickAdd?: (ingredientId: IngredientId) => void;
  featured?: boolean;
}) {
  const ready = match.category === 'ready' || match.category === 'readyWithSubstitution';
  const quickAddId = match.missingRequired.length === 1 ? match.missingRequired[0] : undefined;

  return (
    <View style={[styles.card, featured && styles.cardFeatured]}>
      <View style={[styles.accent, { backgroundColor: match.recipe.accent }]} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${match.recipe.name}. ${categoryLabel(match.category)}. ${match.explanation}`}
        accessibilityHint="Opens recipe details"
        onPress={onPress}
        style={({ pressed }) => [styles.cardPressArea, pressed && styles.pressed]}
      >
        <View style={styles.topRow}>
          <InlinePill
            label={categoryLabel(match.category)}
            tone={ready ? 'ready' : match.category === 'oneAway' ? 'attention' : 'neutral'}
          />
          <Text style={styles.arrow}>↗</Text>
        </View>

        <View style={styles.copy}>
          <Text style={styles.eyebrow}>{match.recipe.eyebrow}</Text>
          <Text accessibilityRole="header" style={[styles.name, featured && styles.nameFeatured]}>
            {match.recipe.name}
          </Text>
          <Text style={styles.description}>{match.recipe.description}</Text>
        </View>

        <View style={styles.explanation}>
          <View style={[styles.explanationRule, { backgroundColor: ready ? colors.ready : colors.brass }]} />
          <Text style={styles.explanationText}>{match.explanation}</Text>
        </View>
      </Pressable>

      <View style={styles.footer}>
        <Text style={styles.meta}>{match.recipe.preparationMinutes} min</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.meta}>{match.recipe.difficulty}</Text>
        {quickAddId && onQuickAdd ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Add ${ingredientById[quickAddId].shortName}`}
            onPress={() => onQuickAdd(quickAddId)}
            hitSlop={8}
            style={({ pressed }) => [styles.quickAdd, pressed && styles.pressed]}
          >
            <Text style={styles.quickAddText}>＋ Add it</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  cardFeatured: { padding: spacing.xxl, borderRadius: radius.xl, backgroundColor: '#181C18' },
  cardPressArea: { gap: spacing.lg },
  pressed: { opacity: 0.76 },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 19 },
  copy: { gap: 6 },
  eyebrow: { color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.15, textTransform: 'uppercase' },
  name: { color: colors.paper, fontFamily: fonts.display, fontSize: 29, lineHeight: 34 },
  nameFeatured: { fontSize: 36, lineHeight: 42 },
  description: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, maxWidth: 520 },
  explanation: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: colors.inkRaised, borderRadius: radius.md, padding: spacing.md, gap: spacing.md },
  explanationRule: { width: 2, borderRadius: 1 },
  explanationText: { flex: 1, color: colors.paper, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  footer: { flexDirection: 'row', alignItems: 'center', minHeight: 24 },
  meta: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 12 },
  metaDot: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 12, marginHorizontal: spacing.sm },
  quickAdd: { marginLeft: 'auto', minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.brassSoft },
  quickAddText: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 12 },
});
