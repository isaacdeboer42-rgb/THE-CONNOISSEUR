import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ingredientById } from '@/data/catalog';
import { formatRequirementAmount } from '@/domain/format';
import { IngredientId, MeasurementSystem, RecipeRequirement } from '@/domain/types';
import { colors, fonts, spacing } from '@/theme/tokens';

export function IngredientRow({
  requirement,
  status,
  servings,
  baseServings,
  measurementSystem = 'metric',
}: {
  requirement: RecipeRequirement;
  status: 'onHand' | 'missing' | 'optional' | 'unconfirmed';
  servings: number;
  baseServings: number;
  measurementSystem?: MeasurementSystem;
}) {
  const ingredientId = requirement.alternatives[0] as IngredientId;
  const ingredient = ingredientById[ingredientId];
  const labels = {
    onHand: 'On hand',
    missing: 'Missing',
    optional: 'Optional garnish',
    unconfirmed: 'Not confirmed',
  };

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${ingredient.name}, ${formatRequirementAmount(requirement, servings, baseServings, measurementSystem)}, ${labels[status]}`}
    >
      <View style={[styles.status, styles[`status_${status}`]]}>
        <Text style={[styles.statusGlyph, styles[`statusGlyph_${status}`]]}>
          {status === 'onHand' ? '✓' : status === 'optional' ? '○' : status === 'unconfirmed' ? '?' : '−'}
        </Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.name}>{ingredient.name}</Text>
        {requirement.preparation ? <Text style={styles.preparation}>{requirement.preparation}</Text> : null}
      </View>
      <View style={styles.value}>
        <Text style={styles.amount}>{formatRequirementAmount(requirement, servings, baseServings, measurementSystem)}</Text>
        <Text style={[styles.label, styles[`label_${status}`]]}>{labels[status]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider, gap: spacing.md },
  status: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  status_onHand: { backgroundColor: colors.readyDeep, borderColor: 'rgba(169,214,141,0.24)' },
  status_missing: { backgroundColor: colors.alertDeep, borderColor: 'rgba(240,161,113,0.24)' },
  status_optional: { backgroundColor: colors.surfaceSoft, borderColor: colors.divider },
  status_unconfirmed: { backgroundColor: colors.brassSoft, borderColor: 'rgba(215,170,98,0.24)' },
  statusGlyph: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  statusGlyph_onHand: { color: colors.ready },
  statusGlyph_missing: { color: colors.alert },
  statusGlyph_optional: { color: colors.paperDim },
  statusGlyph_unconfirmed: { color: colors.brass },
  copy: { flex: 1 },
  name: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 14, lineHeight: 19 },
  preparation: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, lineHeight: 15, marginTop: 2 },
  value: { alignItems: 'flex-end' },
  amount: { color: colors.paper, fontFamily: fonts.body, fontSize: 13 },
  label: { fontFamily: fonts.body, fontSize: 11, marginTop: 3 },
  label_onHand: { color: colors.ready },
  label_missing: { color: colors.alert },
  label_optional: { color: colors.paperDim },
  label_unconfirmed: { color: colors.brass },
});
