import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, EmptyState, Eyebrow, IconButton, InlinePill, Screen, ScreenScroll } from '@/components/ui';
import { ingredients } from '@/data/catalog';
import { IngredientId, PrivateProductUpdateInput } from '@/domain/types';
import { useBar } from '@/state/BarProvider';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

export default function EditPrivateProductScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const privateProductId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { snapshot, updatePrivateProduct } = useBar();
  const product = snapshot.privateProducts.find((item) => item.id === privateProductId);
  const submission = snapshot.productSubmissions.find(
    (item) => item.privateProductId === privateProductId,
  );
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [bottleSize, setBottleSize] = useState('');
  const [ingredientId, setIngredientId] = useState<IngredientId>();
  const [labelPhotoUri, setLabelPhotoUri] = useState<string>();
  const [error, setError] = useState<string>();

  const categoryChoices = useMemo(
    () => ingredients.filter(
      (ingredient) => !ingredient.isStaple && !ingredient.isImplicit && ingredient.id !== 'orange-peel',
    ),
    [],
  );

  useEffect(() => {
    if (!product) return;
    setName(product.name);
    setBrand(product.brand ?? '');
    setBottleSize(product.bottleSizeMl ? String(product.bottleSizeMl) : '');
    setIngredientId(product.ingredientId);
    setLabelPhotoUri(product.labelPhotoUri);
  }, [product]);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/bar'));

  const save = () => {
    if (!product) return;
    if (!name.trim()) {
      setError('Enter the product name shown on the bottle.');
      return;
    }
    if (!ingredientId) {
      setError('Choose the canonical ingredient this bottle supplies.');
      return;
    }
    const parsedBottleSize = bottleSize.trim() ? Number(bottleSize) : undefined;
    if (parsedBottleSize !== undefined && (!Number.isFinite(parsedBottleSize) || parsedBottleSize <= 0 || parsedBottleSize > 10_000)) {
      setError('Bottle size must be a number between 1 and 10,000 ml.');
      return;
    }
    const input: PrivateProductUpdateInput = {
      name: name.trim(),
      ingredientId,
      ...(brand.trim() ? { brand: brand.trim() } : {}),
      ...(parsedBottleSize !== undefined ? { bottleSizeMl: parsedBottleSize } : {}),
      ...(labelPhotoUri ? { labelPhotoUri } : {}),
    };
    updatePrivateProduct(product.id, input);
    goBack();
  };

  return (
    <Screen>
      <ScreenScroll contentStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <IconButton label="Go back" glyph="‹" onPress={goBack} />
          <Text style={styles.topLabel}>PRIVATE BOTTLE</Text>
          <View style={styles.headerSpacer} />
        </View>

        {!product ? (
          <EmptyState
            glyph="⌁"
            title="This private bottle is unavailable"
            body="It may have been removed from local storage. Return to My Bar and scan or add another entry."
            action={<Button label="Open My Bar" onPress={() => router.replace('/(tabs)/bar')} />}
          />
        ) : (
          <>
            <Eyebrow>Private inventory</Eyebrow>
            <Text accessibilityRole="header" style={styles.title}>Edit your bottle.</Text>
            <Text style={styles.subtitle}>
              These details stay on this device. Changing the ingredient mapping updates recommendations for your private inventory only.
            </Text>

            <View style={styles.identityCard}>
              <InlinePill label="Private entry" tone="brass" />
              <Text style={styles.barcode}>{product.barcode} · {product.symbology.toUpperCase()}</Text>
              <Text style={styles.identityNote}>The barcode identity cannot be edited. Scan a different code to create another bottle.</Text>
            </View>

            {submission?.shareConsent ? (
              <View style={styles.reviewNotice}>
                <Text style={styles.reviewTitle}>Catalogue evidence remains unchanged</Text>
                <Text style={styles.reviewBody}>
                  This bottle’s local submission is {submission.status.replace('_', ' ')}. Editing your private details does not rewrite its extracted evidence or review decision.
                </Text>
              </View>
            ) : null}

            <View style={styles.form}>
              <Field
                label="Product name · required"
                value={name}
                onChangeText={(value) => { setName(value); setError(undefined); }}
                placeholder="Bottle name"
              />
              <Field
                label="Brand · optional"
                value={brand}
                onChangeText={(value) => { setBrand(value); setError(undefined); }}
                placeholder="Name on the label"
              />
              <Field
                label="Bottle size in ml · optional"
                value={bottleSize}
                onChangeText={(value) => { setBottleSize(value); setError(undefined); }}
                placeholder="700"
                keyboardType="number-pad"
              />

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Ingredient category · required</Text>
                <View style={styles.categoryGrid} accessibilityRole="radiogroup" accessibilityLabel="Ingredient category">
                  {categoryChoices.map((ingredient) => (
                    <Pressable
                      key={ingredient.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: ingredientId === ingredient.id }}
                      onPress={() => { setIngredientId(ingredient.id); setError(undefined); }}
                      style={[styles.categoryChip, ingredientId === ingredient.id && styles.categoryChipSelected]}
                    >
                      <Text style={[styles.categoryChipText, ingredientId === ingredient.id && styles.categoryChipTextSelected]}>
                        {ingredient.shortName}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.labelCard}>
                <View style={styles.labelCopy}>
                  <Text style={styles.labelTitle}>Optional local label reference</Text>
                  <Text style={styles.labelBody}>This demo URI is never captured or uploaded.</Text>
                </View>
                <Button
                  label={labelPhotoUri ? 'Remove demo reference' : 'Attach demo reference'}
                  variant="secondary"
                  onPress={() => setLabelPhotoUri((current) => current
                    ? undefined
                    : `local-preview://label/${product.barcode}`)}
                />
              </View>

              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              <Button label="Save private changes" onPress={save} />
              <Button label="Cancel" variant="ghost" onPress={goBack} />
            </View>
          </>
        )}
      </ScreenScroll>
    </Screen>
  );
}

function Field({ label, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={colors.paperDim}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: spacing.huge },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, marginBottom: spacing.xxxl },
  topLabel: { color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.4 },
  headerSpacer: { width: 44 },
  title: { color: colors.paper, fontFamily: fonts.display, fontSize: 42, lineHeight: 48, marginTop: spacing.sm, maxWidth: 650 },
  subtitle: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 22, marginTop: spacing.md, maxWidth: 650 },
  identityCard: { gap: spacing.sm, marginTop: spacing.xxl, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
  barcode: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 12, letterSpacing: 0.8 },
  identityNote: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, lineHeight: 17 },
  reviewNotice: { gap: spacing.sm, marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(215,170,98,0.24)', backgroundColor: colors.brassSoft },
  reviewTitle: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 13 },
  reviewBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 11, lineHeight: 17 },
  form: { gap: spacing.lg, marginTop: spacing.xxl },
  field: { gap: spacing.sm },
  fieldLabel: { color: colors.paperMuted, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  input: { minHeight: 54, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.inkRaised, color: colors.paper, fontFamily: fonts.body, fontSize: 15, paddingHorizontal: spacing.lg },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryChip: { minHeight: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.inkRaised, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  categoryChipSelected: { borderColor: colors.brass, backgroundColor: colors.brassSoft },
  categoryChipText: { color: colors.paperMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  categoryChipTextSelected: { color: colors.brass },
  labelCard: { gap: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.inkRaised, padding: spacing.lg },
  labelCopy: { gap: 4 },
  labelTitle: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 13 },
  labelBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 11, lineHeight: 17 },
  error: { color: colors.alert, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 18 },
});
