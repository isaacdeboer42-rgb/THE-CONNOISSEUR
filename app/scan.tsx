import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Eyebrow, IconButton, InlinePill, Screen, ScreenScroll } from '@/components/ui';
import { ingredients } from '@/data/catalog';
import { products } from '@/data/products';
import { BarcodeResolution, resolveBarcode } from '@/domain/barcode';
import { IngredientId, NewPrivateProductInput } from '@/domain/types';
import { useBar } from '@/state/BarProvider';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

type OverlapMode = 'replaceGeneric' | 'keepBoth';
type AddStatus = 'added' | 'restocked' | 'duplicate' | 'alreadyProcessed';

const RECOGNISED_FIXTURE = '9300000000019';
const UNKNOWN_FIXTURE = '9300000000026';

function operationId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function statusCopy(status: AddStatus): string {
  switch (status) {
    case 'added':
      return 'Bottle added to your bar. Recommendations now use its mapped ingredient.';
    case 'restocked':
      return 'This bottle was already known and is back on hand.';
    case 'duplicate':
      return 'This exact bottle is already on hand. Nothing was duplicated.';
    case 'alreadyProcessed':
      return 'This scan operation was already completed. Nothing was duplicated.';
  }
}

export default function ScanScreen() {
  const router = useRouter();
  const {
    snapshot,
    addVerifiedProduct,
    addPrivateProduct,
    submitPrivateProduct,
    advanceProductSubmission,
  } = useBar();
  const [barcode, setBarcode] = useState('');
  const [resolution, setResolution] = useState<BarcodeResolution>();
  const [scanOperationId, setScanOperationId] = useState(() => operationId('scan'));
  const [overlapMode, setOverlapMode] = useState<OverlapMode>();
  const [addStatus, setAddStatus] = useState<AddStatus>();
  const [scanError, setScanError] = useState<string>();

  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('');
  const [bottleSize, setBottleSize] = useState('');
  const [ingredientId, setIngredientId] = useState<IngredientId>();
  const [labelPhotoUri, setLabelPhotoUri] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [privateProductId, setPrivateProductId] = useState<string>();
  const [submissionId, setSubmissionId] = useState<string>();
  const [processing, setProcessing] = useState(false);
  const [submissionError, setSubmissionError] = useState<string>();

  const categoryChoices = useMemo(
    () => ingredients.filter((ingredient) => !ingredient.isStaple && !ingredient.isImplicit && ingredient.id !== 'orange-peel'),
    [],
  );
  const localSuggestions = ingredientId
    ? products.filter((product) => product.ingredientId === ingredientId)
    : [];

  const submission = submissionId
    ? snapshot.productSubmissions.find((item) => item.id === submissionId)
    : undefined;
  const knownProduct = resolution?.status === 'verified' ? resolution.product : undefined;
  const hasExactKnownProduct = knownProduct
    ? snapshot.inventory.some((item) => item.productId === knownProduct.id)
    : false;
  const hasGenericOverlap = knownProduct && !hasExactKnownProduct
    ? snapshot.inventory.some(
        (item) => item.source === 'generic' && item.ingredientId === knownProduct.ingredientId,
      )
    : false;

  useEffect(() => {
    if (knownProduct && addStatus) {
      const stillOnHand = snapshot.inventory.some(
        (item) => item.productId === knownProduct.id && item.status === 'onHand',
      );
      if (!stillOnHand) {
        setAddStatus(undefined);
        setOverlapMode(undefined);
        setScanOperationId(operationId('scan'));
      }
    }

    if (privateProductId) {
      const productStillExists = snapshot.privateProducts.some(
        (product) => product.id === privateProductId,
      );
      const stillOnHand = snapshot.inventory.some(
        (item) => item.privateProductId === privateProductId && item.status === 'onHand',
      );
      if (!productStillExists || !stillOnHand) {
        setPrivateProductId(undefined);
        setSubmissionId(undefined);
        setAddStatus(undefined);
        setProcessing(false);
        setSubmissionError(undefined);
        setScanOperationId(operationId('scan'));
      }
    }
  }, [addStatus, knownProduct, privateProductId, snapshot.inventory, snapshot.privateProducts]);

  const resolveCurrentBarcode = (rawValue = barcode) => {
    const next = resolveBarcode(rawValue);
    setBarcode(rawValue);
    setResolution(next);
    setScanOperationId(operationId('scan'));
    setOverlapMode(undefined);
    setAddStatus(undefined);
    setScanError(next.status === 'invalid' || next.status === 'unavailable' ? next.reason : undefined);
    setPrivateProductId(undefined);
    setSubmissionId(undefined);
    setProcessing(false);
    setSubmissionError(undefined);
    setFormError(undefined);
    if (next.status === 'unknown') {
      setLabelPhotoUri(undefined);
    }
  };

  const resetScan = () => {
    setBarcode('');
    setResolution(undefined);
    setScanOperationId(operationId('scan'));
    setOverlapMode(undefined);
    setAddStatus(undefined);
    setScanError(undefined);
    setProductName('');
    setBrand('');
    setBottleSize('');
    setIngredientId(undefined);
    setLabelPhotoUri(undefined);
    setFormError(undefined);
    setPrivateProductId(undefined);
    setSubmissionId(undefined);
    setProcessing(false);
    setSubmissionError(undefined);
  };

  const addKnownBottle = () => {
    if (resolution?.status !== 'verified') return;
    if (hasGenericOverlap && !overlapMode) {
      setScanError('Choose whether to replace the generic ingredient or keep both entries.');
      return;
    }
    setScanError(undefined);
    const result = addVerifiedProduct(
      resolution.product.id,
      scanOperationId,
      overlapMode ?? 'keepBoth',
      {
        originalBarcode: resolution.originalBarcode,
        symbology: resolution.symbology,
      },
    );
    setAddStatus(result.status);
  };

  const savePrivateBottle = () => {
    if (resolution?.status !== 'unknown') return;
    if (!productName.trim()) {
      setFormError('Enter the product name shown on the bottle.');
      return;
    }
    if (!ingredientId) {
      setFormError('Choose the canonical ingredient this bottle should supply.');
      return;
    }

    const parsedBottleSize = bottleSize.trim() ? Number(bottleSize) : undefined;
    if (parsedBottleSize !== undefined && (!Number.isFinite(parsedBottleSize) || parsedBottleSize <= 0 || parsedBottleSize > 10_000)) {
      setFormError('Bottle size must be a number between 1 and 10,000 ml.');
      return;
    }

    const input: NewPrivateProductInput = {
      barcode: resolution.canonicalBarcode,
      originalBarcode: resolution.originalBarcode,
      symbology: resolution.symbology,
      name: productName.trim(),
      ingredientId,
      ...(brand.trim() ? { brand: brand.trim() } : {}),
      ...(parsedBottleSize !== undefined ? { bottleSizeMl: parsedBottleSize } : {}),
      ...(labelPhotoUri ? { labelPhotoUri } : {}),
    };

    setFormError(undefined);
    const result = addPrivateProduct(input, scanOperationId);
    setPrivateProductId(result.privateProductId);
    const existingSubmission = snapshot.productSubmissions.find(
      (item) => item.privateProductId === result.privateProductId,
    );
    setSubmissionId(existingSubmission?.shareConsent ? existingSubmission.id : undefined);
    setAddStatus(result.status);
  };

  const processSubmission = async (targetSubmissionId: string, simulateFailure = false) => {
    if (processing) return;
    setProcessing(true);
    setSubmissionError(undefined);
    try {
      await advanceProductSubmission(targetSubmissionId, simulateFailure);
    } catch (error: unknown) {
      setSubmissionError(error instanceof Error ? error.message : 'Simulated processing did not complete.');
    } finally {
      setProcessing(false);
    }
  };

  const shareForReview = async (simulateFailure = false) => {
    if (!privateProductId || processing) return;
    const existingSubmission = snapshot.productSubmissions.find(
      (item) => item.privateProductId === privateProductId,
    );
    let nextSubmissionId: string;
    try {
      nextSubmissionId = submitPrivateProduct(privateProductId);
    } catch (error: unknown) {
      setSubmissionError(error instanceof Error ? error.message : 'The private bottle is no longer available.');
      return;
    }
    setSubmissionId(nextSubmissionId);
    if (
      existingSubmission &&
      existingSubmission.status !== 'draft' &&
      existingSubmission.status !== 'submitted' &&
      existingSubmission.status !== 'processing'
    ) {
      return;
    }
    await processSubmission(nextSubmissionId, simulateFailure);
  };

  return (
    <Screen>
      <ScreenScroll contentStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <IconButton
            label="Go back"
            glyph="‹"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/bar'))}
          />
          <Text style={styles.topLabel}>BOTTLE SCAN · LOCAL PREVIEW</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Eyebrow>Milestone 3 simulation</Eyebrow>
        <Text accessibilityRole="header" style={styles.title}>Resolve a bottle without losing your place.</Text>
        <Text style={styles.subtitle}>
          The camera, external barcode provider and shared catalogue are not connected in this build. Use a fixture or enter a UPC/EAN to exercise the complete recovery flow locally.
        </Text>

        <View style={styles.simulationNotice} accessibilityRole="summary">
          <Text style={styles.simulationGlyph}>⌁</Text>
          <View style={styles.simulationCopy}>
            <Text style={styles.simulationTitle}>No camera permission requested</Text>
            <Text style={styles.simulationBody}>This screen validates real UPC-A/EAN-13 checksums, then resolves only against a fictional local fixture catalogue.</Text>
          </View>
        </View>

        {!resolution ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Enter a barcode</Text>
            <Text style={styles.panelBody}>Spaces and hyphens are accepted. Invalid checksums are rejected before lookup.</Text>
            <Text style={styles.fieldLabel}>UPC-A or EAN-13</Text>
            <TextInput
              accessibilityLabel="UPC-A or EAN-13 barcode"
              value={barcode}
              onChangeText={(value) => {
                setBarcode(value);
                setScanError(undefined);
              }}
              keyboardType="number-pad"
              placeholder="9300000000019"
              placeholderTextColor={colors.paperDim}
              style={styles.input}
              onSubmitEditing={() => resolveCurrentBarcode()}
            />
            {scanError ? <Text accessibilityRole="alert" style={styles.error}>{scanError}</Text> : null}
            <Button label="Resolve barcode" disabled={!barcode.trim()} onPress={() => resolveCurrentBarcode()} />

            <View style={styles.fixtureDivider}>
              <View style={styles.fixtureLine} />
              <Text style={styles.fixtureLabel}>USABILITY FIXTURES</Text>
              <View style={styles.fixtureLine} />
            </View>
            <View style={styles.fixtureActions}>
              <Button
                label="Simulate recognised vodka"
                variant="secondary"
                onPress={() => resolveCurrentBarcode(RECOGNISED_FIXTURE)}
                style={styles.fixtureButton}
              />
              <Button
                label="Simulate unknown bottle"
                variant="secondary"
                onPress={() => resolveCurrentBarcode(UNKNOWN_FIXTURE)}
                style={styles.fixtureButton}
              />
            </View>
          </View>
        ) : null}

        {resolution?.status === 'invalid' || resolution?.status === 'unavailable' ? (
          <View style={styles.resultPanel} accessibilityLiveRegion="polite">
            <InlinePill label={resolution.status === 'invalid' ? 'Invalid barcode' : 'Lookup unavailable'} tone="attention" />
            <Text style={styles.resultTitle}>This code could not be resolved.</Text>
            <Text accessibilityRole="alert" style={styles.resultBody}>{resolution.reason}</Text>
            <View style={styles.actions}>
              <Button label="Try another barcode" onPress={resetScan} />
            </View>
          </View>
        ) : null}

        {resolution?.status === 'verified' ? (
          <View style={styles.resultPanel} accessibilityLiveRegion="polite">
            <View style={styles.resultHeader}>
              <InlinePill label="Verified local fixture" tone="ready" />
              <Text style={styles.barcodeText}>{resolution.canonicalBarcode}</Text>
            </View>
            <Text style={styles.resultEyebrow}>{resolution.product.brand}</Text>
            <Text style={styles.resultTitle}>{resolution.product.name}</Text>
            <Text style={styles.resultBody}>
              {resolution.product.bottleSizeMl} ml · Maps to {resolution.product.ingredientId}. Recommendations use the ingredient mapping, while My Bar keeps the bottle identity.
            </Text>

            {hasGenericOverlap && !addStatus ? (
              <View style={styles.overlapCard}>
                <Text style={styles.overlapTitle}>You already track generic {resolution.product.ingredientId}.</Text>
                <Text style={styles.overlapBody}>Choose how this specific bottle should be recorded. Nothing changes until you add it.</Text>
                <View accessibilityRole="radiogroup" accessibilityLabel="Generic ingredient overlap choice" style={styles.choiceRow}>
                  <ChoiceButton
                    label="Replace generic"
                    selected={overlapMode === 'replaceGeneric'}
                    onPress={() => setOverlapMode('replaceGeneric')}
                  />
                  <ChoiceButton
                    label="Keep both"
                    selected={overlapMode === 'keepBoth'}
                    onPress={() => setOverlapMode('keepBoth')}
                  />
                </View>
              </View>
            ) : null}

            {scanError ? <Text accessibilityRole="alert" style={styles.error}>{scanError}</Text> : null}
            {addStatus ? (
              <View style={styles.successCard}>
                <Text style={styles.successTitle}>{addStatus === 'duplicate' || addStatus === 'alreadyProcessed' ? 'No duplicate created' : 'Bottle saved'}</Text>
                <Text style={styles.successBody}>{statusCopy(addStatus)}</Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              {!addStatus ? <Button label="Add this bottle" onPress={addKnownBottle} /> : null}
              {addStatus ? <Button label="See updated recommendations" onPress={() => router.replace('/(tabs)/tonight')} /> : null}
              <Button label="Open My Bar" variant="secondary" onPress={() => router.replace('/(tabs)/bar')} />
              <Button label="Scan another" variant="ghost" onPress={resetScan} />
            </View>
          </View>
        ) : null}

        {resolution?.status === 'unknown' ? (
          <View style={styles.resultPanel} accessibilityLiveRegion="polite">
            <View style={styles.resultHeader}>
              <InlinePill label="Unknown barcode" tone="attention" />
              <Text style={styles.barcodeText}>{resolution.canonicalBarcode}</Text>
            </View>
            <Text style={styles.resultTitle}>Keep the bottle useful now.</Text>
            <Text style={styles.resultBody}>Save a private bottle with a canonical ingredient mapping first. Sharing it for simulated catalogue review is a separate choice.</Text>

            {!privateProductId ? (
              <View style={styles.form}>
                <Field
                  label="Product name · required"
                  value={productName}
                  onChangeText={(value) => {
                    setProductName(value);
                    setFormError(undefined);
                  }}
                  placeholder="Vodka, gin, liqueur…"
                />
                <Field
                  label="Brand · optional"
                  value={brand}
                  onChangeText={(value) => {
                    setBrand(value);
                    setFormError(undefined);
                  }}
                  placeholder="Name on the label"
                />
                <Field
                  label="Bottle size in ml · optional"
                  value={bottleSize}
                  onChangeText={(value) => {
                    setBottleSize(value);
                    setFormError(undefined);
                  }}
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
                        onPress={() => {
                          setIngredientId(ingredient.id);
                          setFormError(undefined);
                        }}
                        style={[styles.categoryChip, ingredientId === ingredient.id && styles.categoryChipSelected]}
                      >
                        <Text style={[styles.categoryChipText, ingredientId === ingredient.id && styles.categoryChipTextSelected]}>{ingredient.shortName}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {ingredientId ? (
                  <View style={styles.suggestionCard}>
                    <Text style={styles.suggestionTitle}>Non-blocking local suggestions</Text>
                    {localSuggestions.length ? localSuggestions.map((product) => (
                      <Text key={product.id} style={styles.suggestionBody}>
                        Similar category: {product.brand} {product.name}. Its barcode is different, so your private entry will not be replaced automatically.
                      </Text>
                    )) : (
                      <Text style={styles.suggestionBody}>
                        No similar fixture is stored locally. You can still save this private bottle now.
                      </Text>
                    )}
                  </View>
                ) : null}

                <View style={styles.labelCard}>
                  <View style={styles.labelCopy}>
                    <Text style={styles.labelTitle}>Optional label reference</Text>
                    <Text style={styles.labelBody}>No image is captured or uploaded. Add a demo-only local URI to test downstream metadata.</Text>
                  </View>
                  <Button
                    label={labelPhotoUri ? 'Remove demo reference' : 'Attach demo label reference'}
                    variant="secondary"
                    onPress={() => setLabelPhotoUri((current) => current ? undefined : `local-preview://label/${resolution.canonicalBarcode}`)}
                  />
                </View>

                {labelPhotoUri ? <Text style={styles.referenceText}>Attached locally: {labelPhotoUri}</Text> : null}
                {formError ? <Text accessibilityRole="alert" style={styles.error}>{formError}</Text> : null}
                <Button label="Save private bottle" onPress={savePrivateBottle} />
              </View>
            ) : (
              <View style={styles.savedSection}>
                <View style={styles.successCard}>
                  <Text style={styles.successTitle}>
                    {addStatus === 'duplicate' || addStatus === 'alreadyProcessed'
                      ? 'Private bottle already saved'
                      : addStatus === 'restocked'
                        ? 'Private bottle restocked'
                        : 'Private bottle saved first'}
                  </Text>
                  <Text style={styles.successBody}>{statusCopy(addStatus ?? 'added')} It is usable in recommendations even if catalogue processing is skipped or fails.</Text>
                </View>

                {!submissionId ? (
                  <View style={styles.shareCard}>
                    <Text style={styles.shareTitle}>Share with the catalogue preview?</Text>
                    <Text style={styles.shareBody}>This opt-in starts a local simulation only. No bottle data or label reference leaves this device.</Text>
                    {submissionError ? <Text accessibilityRole="alert" style={styles.error}>{submissionError}</Text> : null}
                    <Button label="Submit to simulated review" variant="secondary" onPress={() => void shareForReview()} />
                    <Button label="Exercise retryable failure" variant="ghost" onPress={() => void shareForReview(true)} />
                  </View>
                ) : (
                  <View style={styles.submissionCard}>
                    <View style={styles.submissionHeader}>
                      <Text style={styles.submissionTitle}>Catalogue submission</Text>
                      <InlinePill
                        label={processing ? 'Processing' : (submission?.status ?? 'Submitted').replace('_', ' ')}
                        tone={submission?.status === 'pending_review'
                          ? 'brass'
                          : submission?.status === 'approved' || submission?.status === 'merged'
                            ? 'ready'
                            : submission?.status === 'rejected'
                              ? 'attention'
                              : 'neutral'}
                      />
                    </View>
                    <Text style={styles.submissionBody}>
                      {processing
                        ? 'Running deterministic demo extraction and schema validation…'
                        : submission?.status === 'approved'
                          ? 'This contribution was approved in the local preview. Nothing was published or shared.'
                          : submission?.status === 'merged'
                            ? 'This contribution was merged in the local preview. Your private bottle and mapping are unchanged.'
                            : submission?.status === 'rejected'
                              ? 'This contribution was rejected in the local preview. Your private bottle remains saved and usable.'
                              : submission?.status === 'pending_review'
                                ? 'Private inventory is unchanged. A local reviewer can now approve, merge or reject this submission.'
                                : 'Private inventory is unchanged. Resume the local extraction whenever you are ready.'}
                    </Text>
                    {submissionError ? (
                      <>
                        <Text accessibilityRole="alert" style={styles.error}>{submissionError}</Text>
                        <Button
                          label="Retry simulated processing"
                          variant="secondary"
                          onPress={() => void processSubmission(submissionId)}
                        />
                      </>
                    ) : null}
                    {!processing && !submissionError && (submission?.status === 'submitted' || submission?.status === 'processing') ? (
                      <Button
                        label="Resume simulated processing"
                        variant="secondary"
                        onPress={() => void processSubmission(submissionId)}
                      />
                    ) : null}
                    {submission?.status === 'pending_review' ? (
                      <Button
                        label="Open local catalogue review"
                        variant="secondary"
                        onPress={() => router.push('/catalogue' as never)}
                      />
                    ) : null}
                  </View>
                )}

                <View style={styles.actions}>
                  <Button label="Open My Bar" onPress={() => router.replace('/(tabs)/bar')} />
                  <Button label="See recommendations" variant="secondary" onPress={() => router.replace('/(tabs)/tonight')} />
                  <Button label="Scan another" variant="ghost" onPress={resetScan} />
                </View>
              </View>
            )}
          </View>
        ) : null}
      </ScreenScroll>
    </Screen>
  );
}

function ChoiceButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.choiceButton, selected && styles.choiceButtonSelected]}
    >
      <Text style={[styles.choiceButtonText, selected && styles.choiceButtonTextSelected]}>{label}</Text>
    </Pressable>
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
  topLabel: { color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.2 },
  headerSpacer: { width: 44 },
  title: { color: colors.paper, fontFamily: fonts.display, fontSize: 42, lineHeight: 48, marginTop: spacing.sm, maxWidth: 650 },
  subtitle: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 15, lineHeight: 23, marginTop: spacing.md, maxWidth: 620 },
  simulationNotice: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xxl, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(215,170,98,0.24)', backgroundColor: colors.brassSoft, padding: spacing.lg },
  simulationGlyph: { color: colors.brass, fontFamily: fonts.display, fontSize: 23 },
  simulationCopy: { flex: 1 },
  simulationTitle: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 13 },
  simulationBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, marginTop: 4 },
  panel: { gap: spacing.lg, marginTop: spacing.xxl, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, padding: spacing.xl },
  panelTitle: { color: colors.paper, fontFamily: fonts.display, fontSize: 27 },
  panelBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },
  field: { gap: spacing.sm },
  fieldLabel: { color: colors.paperMuted, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  input: { minHeight: 54, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.inkRaised, color: colors.paper, fontFamily: fonts.body, fontSize: 15, paddingHorizontal: spacing.lg },
  error: { color: colors.alert, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 18 },
  fixtureDivider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  fixtureLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.divider },
  fixtureLabel: { color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.1 },
  fixtureActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fixtureButton: { flexGrow: 1, flexBasis: 220 },
  resultPanel: { gap: spacing.lg, marginTop: spacing.xxl, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, padding: spacing.xl },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  barcodeText: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 12, letterSpacing: 1 },
  resultEyebrow: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' },
  resultTitle: { color: colors.paper, fontFamily: fonts.display, fontSize: 30, lineHeight: 35 },
  resultBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  overlapCard: { gap: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.inkRaised, padding: spacing.lg },
  overlapTitle: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 13 },
  overlapBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  choiceButton: { flex: 1, flexBasis: 140, minHeight: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.divider, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md },
  choiceButtonSelected: { borderColor: colors.brass, backgroundColor: colors.brassSoft },
  choiceButtonText: { color: colors.paperMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  choiceButtonTextSelected: { color: colors.brass },
  successCard: { gap: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(169,214,141,0.28)', backgroundColor: colors.readyDeep, padding: spacing.lg },
  successTitle: { color: colors.ready, fontFamily: fonts.bodyMedium, fontSize: 14 },
  successBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  form: { gap: spacing.lg, paddingTop: spacing.sm },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  categoryChip: { minHeight: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.inkRaised, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  categoryChipSelected: { borderColor: colors.brass, backgroundColor: colors.brassSoft },
  categoryChipText: { color: colors.paperMuted, fontFamily: fonts.bodyMedium, fontSize: 12 },
  categoryChipTextSelected: { color: colors.brass },
  suggestionCard: { gap: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surfaceSoft, padding: spacing.lg },
  suggestionTitle: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 12 },
  suggestionBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 11, lineHeight: 17 },
  labelCard: { gap: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.inkRaised, padding: spacing.lg },
  labelCopy: { gap: 4 },
  labelTitle: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 13 },
  labelBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  referenceText: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, lineHeight: 17 },
  savedSection: { gap: spacing.lg },
  shareCard: { gap: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.inkRaised, padding: spacing.lg },
  shareTitle: { color: colors.paper, fontFamily: fonts.display, fontSize: 21 },
  shareBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  submissionCard: { gap: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(215,170,98,0.24)', backgroundColor: colors.brassSoft, padding: spacing.lg },
  submissionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm },
  submissionTitle: { color: colors.paper, fontFamily: fonts.display, fontSize: 21 },
  submissionBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
});
