import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, EmptyState, Eyebrow, Screen, ScreenScroll, SectionHeading } from '@/components/ui';
import { ingredientById } from '@/data/catalog';
import { verifiedProductById } from '@/data/products';
import { BasicId } from '@/domain/types';
import { useBar } from '@/state/BarProvider';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

export default function MyBarScreen() {
  const router = useRouter();
  const { snapshot, mode, removeInventoryItem, setInventoryItemStatus } = useBar();
  const onHand = snapshot.inventory.filter((item) => item.status === 'onHand');
  const outOfStock = snapshot.inventory.filter((item) => item.status === 'outOfStock');
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
          <View style={styles.headerActions}>
            <Button label="Scan bottle" variant="secondary" onPress={() => router.push('/scan' as never)} style={styles.addButton} />
            <Button label="＋ Add" variant="ghost" onPress={() => router.push('/setup')} style={styles.addButton} />
          </View>
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

        {snapshot.inventory.length === 0 ? (
          <EmptyState
            glyph="▥"
            title="An empty shelf is still a starting point"
            body="Scan a demo bottle or add one spirit, sweetener or citrus manually and recommendations will begin to take shape."
            action={(
              <View style={styles.emptyActions}>
                <Button label="Scan a bottle" onPress={() => router.push('/scan' as never)} />
                <Button label="Add manually" variant="secondary" onPress={() => router.push('/setup')} />
              </View>
            )}
          />
        ) : (
          <>
            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{onHand.length}</Text>
                <Text style={styles.summaryLabel}>On hand</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{outOfStock.length}</Text>
                <Text style={styles.summaryLabel}>Out of stock</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryValue}>{availableIceCount} / 2</Text>
                <Text style={styles.summaryLabel}>Ice formats on hand</Text>
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeading eyebrow="Bottles & ingredients" title="What your bar supplies" />
              {onHand.length === 0 ? (
                <Text style={styles.stockNotice}>Nothing is currently on hand. Restock an ingredient below to bring matching recipes back.</Text>
              ) : null}
              <View style={styles.list}>
                {snapshot.inventory.map((item) => {
                  const ingredient = ingredientById[item.ingredientId];
                  const verifiedProduct = item.productId ? verifiedProductById[item.productId] : undefined;
                  const privateProduct = item.privateProductId
                    ? snapshot.privateProducts.find((product) => product.id === item.privateProductId)
                    : undefined;
                  const isOutOfStock = item.status === 'outOfStock';
                  const bottle = verifiedProduct ?? privateProduct;
                  const displayName = bottle?.name ?? ingredient.name;
                  const sourceLabel = verifiedProduct
                    ? `${verifiedProduct.brand} · ${verifiedProduct.bottleSizeMl} ml · verified fixture`
                    : privateProduct
                      ? `${privateProduct.brand || 'Private bottle'}${privateProduct.bottleSizeMl ? ` · ${privateProduct.bottleSizeMl} ml` : ''} · private entry`
                      : 'Generic ingredient';
                  return (
                    <View key={item.id} style={[styles.row, isOutOfStock && styles.rowOutOfStock]}>
                      <View style={[styles.initial, isOutOfStock && styles.initialOutOfStock]}>
                        <Text style={[styles.initialText, isOutOfStock && styles.initialTextOutOfStock]}>{displayName.charAt(0)}</Text>
                      </View>
                      <View style={styles.rowCopy}>
                        <View style={styles.rowTitleLine}>
                          <Text style={styles.rowName}>{displayName}</Text>
                          {bottle ? <Text style={styles.productBadge}>{verifiedProduct ? 'VERIFIED' : 'PRIVATE'}</Text> : null}
                        </View>
                        <Text style={styles.rowCategory}>
                          {sourceLabel}
                        </Text>
                        <Text style={styles.rowMapping}>
                          Maps to {ingredient.shortName} · {isOutOfStock ? 'Out of stock' : 'On hand'}
                          {bottle?.barcode ? ` · ${bottle.barcode}` : ''}
                        </Text>
                      </View>
                      <View style={styles.rowActions}>
                        {privateProduct ? (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Edit ${displayName}`}
                            onPress={() => router.push(`/product/${privateProduct.id}` as never)}
                            style={styles.editButton}
                          >
                            <Text style={styles.editButtonText}>Edit</Text>
                          </Pressable>
                        ) : null}
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={isOutOfStock ? `Restock ${displayName}` : `Mark ${displayName} out of stock`}
                          onPress={() => setInventoryItemStatus(item.id, isOutOfStock ? 'onHand' : 'outOfStock')}
                          style={[styles.stockButton, isOutOfStock && styles.restockButton]}
                        >
                          <Text style={[styles.stockButtonText, isOutOfStock && styles.restockButtonText]}>
                            {isOutOfStock ? 'Restock' : 'Mark empty'}
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${displayName}`}
                          onPress={() => removeInventoryItem(item.id)}
                          style={styles.removeButton}
                        >
                          <Text style={styles.remove}>Remove</Text>
                        </Pressable>
                      </View>
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
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: spacing.sm, flexShrink: 1 },
  addButton: { minHeight: 44, paddingHorizontal: spacing.lg },
  utilityRow: { flexDirection: 'row', gap: spacing.sm, marginTop: -spacing.md, marginBottom: spacing.xl },
  utilityButton: { flex: 1, minHeight: 44, paddingHorizontal: spacing.sm },
  demoNote: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.brassSoft, borderWidth: 1, borderColor: 'rgba(215,170,98,0.22)', marginBottom: spacing.lg },
  demoNoteTitle: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 12 },
  demoNoteBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 11, marginTop: 4 },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  summaryCard: { flexGrow: 1, flexBasis: 150, minHeight: 110, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, padding: spacing.lg, justifyContent: 'flex-end' },
  summaryValue: { color: colors.paper, fontFamily: fonts.display, fontSize: 34 },
  summaryLabel: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, marginTop: 4 },
  emptyActions: { width: '100%', gap: spacing.sm },
  section: { marginTop: spacing.huge, gap: spacing.lg },
  stockNotice: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  row: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider, paddingVertical: spacing.md },
  rowOutOfStock: { opacity: 0.82 },
  initial: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brassSoft, alignItems: 'center', justifyContent: 'center' },
  initialOutOfStock: { backgroundColor: colors.surfaceSoft },
  initialText: { color: colors.brass, fontFamily: fonts.display, fontSize: 18 },
  initialTextOutOfStock: { color: colors.paperDim },
  rowCopy: { flex: 1, minWidth: 120 },
  rowTitleLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  rowName: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 13 },
  rowCategory: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, marginTop: 4 },
  rowMapping: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, marginTop: 3 },
  productBadge: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 0.8 },
  rowActions: { alignItems: 'stretch', gap: 4 },
  editButton: { minHeight: 44, minWidth: 88, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(215,170,98,0.34)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  editButtonText: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 11 },
  stockButton: { minHeight: 44, minWidth: 88, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.divider, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  restockButton: { borderColor: 'rgba(169,214,141,0.4)', backgroundColor: colors.readyDeep },
  stockButtonText: { color: colors.paperMuted, fontFamily: fonts.bodyMedium, fontSize: 11 },
  restockButtonText: { color: colors.ready },
  removeButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  remove: { color: colors.alert, fontFamily: fonts.bodyMedium, fontSize: 11 },
  stapleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stapleCard: { flex: 1, minHeight: 118, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, padding: spacing.lg },
  stapleGlyph: { color: colors.brass, fontFamily: fonts.body, fontSize: 20 },
  stapleName: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 13, marginTop: spacing.md },
  stapleDescription: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, marginTop: 4 },
  stapleValue: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, textTransform: 'capitalize', marginTop: 4 },
});
