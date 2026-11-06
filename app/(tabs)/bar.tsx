import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, EmptyState, Eyebrow, Screen, ScreenScroll, SectionHeading } from '@/components/ui';
import { ingredientById } from '@/data/catalog';
import { BasicId } from '@/domain/types';
import { useBar } from '@/state/BarProvider';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

export default function MyBarScreen() {
  const router = useRouter();
  const { snapshot, mode, removeIngredient } = useBar();
  const onHand = snapshot.inventory.filter((item) => item.status === 'onHand');
  const iceBasics: Array<{ id: BasicId; label: string; glyph: string; description: string }> = [
    {
      id: 'standard-ice',
      label: 'Standard ice',
      glyph: '◇',
      description: 'Regular cubes for shaking and stirring',
    },
    {
      id: 'large-ice',
      label: 'Large ice',
      glyph: '◆',
      description: 'A large cube for serving the finished drink',
    },
  ];
  const availableIceCount = iceBasics.filter(({ id }) => snapshot.basics[id] === 'available').length;

  return (
    <Screen>
      <ScreenScroll>
        <View style={styles.header}>
          <View>
            <Eyebrow>Inventory</Eyebrow>
            <Text accessibilityRole="header" style={styles.title}>My bar</Text>
          </View>
          <Button label="＋ Add" variant="secondary" onPress={() => router.push('/setup')} style={styles.addButton} />
        </View>

        <View style={styles.utilityRow}>
          <Button label="Shopping" variant="ghost" style={styles.utilityButton} onPress={() => router.push('/shopping')} />
          <Button label="Taste" variant="ghost" style={styles.utilityButton} onPress={() => router.push('/preferences')} />
          <Button label="Account" variant="ghost" style={styles.utilityButton} onPress={() => router.push('/account' as never)} />
        </View>

        {mode === 'sample' ? (
          <View style={styles.demoNote}>
            <Text style={styles.demoNoteTitle}>Sample bar</Text>
            <Text style={styles.demoNoteBody}>Changes here stay in the demo and never touch your guest inventory.</Text>
          </View>
        ) : null}

        {onHand.length === 0 ? (
          <EmptyState
            glyph="▥"
            title="An empty shelf is still a starting point"
            body="Add one spirit, sweetener or citrus and recommendations will begin to take shape."
            action={<Button label="Add my first ingredient" onPress={() => router.push('/setup')} />}
          />
        ) : (
          <>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{onHand.length}</Text>
                <Text style={styles.summaryLabel}>On hand</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{availableIceCount} / 2</Text>
                <Text style={styles.summaryLabel}>Ice formats on hand</Text>
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeading eyebrow="Ingredients view" title="What your bottles supply" />
              <View style={styles.list}>
                {onHand.map((item) => {
                  const ingredient = ingredientById[item.ingredientId];
                  return (
                    <View key={item.id} style={styles.row}>
                      <View style={styles.initial}><Text style={styles.initialText}>{ingredient.shortName.charAt(0)}</Text></View>
                      <View style={styles.rowCopy}>
                        <Text style={styles.rowName}>{ingredient.name}</Text>
                        <Text style={styles.rowCategory}>{ingredient.category} · Generic ingredient</Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${ingredient.name}`}
                        onPress={() => removeIngredient(item.ingredientId)}
                        hitSlop={10}
                      >
                        <Text style={styles.remove}>Remove</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeading eyebrow="Kitchen basics" title="Ice for making and serving" />
              <View style={styles.stapleRow}>
                {iceBasics.map((basic) => (
                  <View key={basic.id} style={styles.stapleCard}>
                    <Text style={styles.stapleGlyph}>{basic.glyph}</Text>
                    <Text style={styles.stapleName}>{basic.label}</Text>
                    <Text style={styles.stapleDescription}>{basic.description}</Text>
                    <Text
                      accessibilityLabel={`${basic.label}: ${snapshot.basics[basic.id]}`}
                      style={styles.stapleValue}
                    >
                      {snapshot.basics[basic.id]}
                    </Text>
                  </View>
                ))}
              </View>
              <Button label="Edit ingredients and ice" variant="ghost" onPress={() => router.push('/setup')} />
            </View>
          </>
        )}
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.md, marginBottom: spacing.xxl },
  title: { color: colors.paper, fontFamily: fonts.display, fontSize: 38, marginTop: 3 },
  addButton: { minHeight: 42, paddingHorizontal: spacing.lg },
  utilityRow: { flexDirection: 'row', gap: spacing.sm, marginTop: -spacing.md, marginBottom: spacing.xl },
  utilityButton: { flex: 1, minHeight: 42, paddingHorizontal: spacing.sm },
  demoNote: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.brassSoft, borderWidth: 1, borderColor: 'rgba(215,170,98,0.22)', marginBottom: spacing.lg },
  demoNoteTitle: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 12 },
  demoNoteBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 11, marginTop: 4 },
  summaryRow: { flexDirection: 'row', gap: spacing.md },
  summaryCard: { flex: 1, minHeight: 110, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, padding: spacing.lg, justifyContent: 'flex-end' },
  summaryValue: { color: colors.paper, fontFamily: fonts.display, fontSize: 34 },
  summaryLabel: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, marginTop: 4 },
  section: { marginTop: spacing.huge, gap: spacing.lg },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  row: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  initial: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brassSoft, alignItems: 'center', justifyContent: 'center' },
  initialText: { color: colors.brass, fontFamily: fonts.display, fontSize: 18 },
  rowCopy: { flex: 1 },
  rowName: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 13 },
  rowCategory: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 10, marginTop: 4 },
  remove: { color: colors.alert, fontFamily: fonts.bodyMedium, fontSize: 10 },
  stapleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stapleCard: { flex: 1, minHeight: 118, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, padding: spacing.lg },
  stapleGlyph: { color: colors.brass, fontFamily: fonts.body, fontSize: 20 },
  stapleName: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.md },
  stapleDescription: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 10, lineHeight: 15, marginTop: 4 },
  stapleValue: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 10, textTransform: 'capitalize', marginTop: 4 },
});
