import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Button,
  EmptyState,
  Eyebrow,
  IconButton,
  InlinePill,
  Screen,
  ScreenScroll,
} from '@/components/ui';
import { ingredientById } from '@/data/catalog';
import { ProductSubmissionStatus } from '@/domain/types';
import { useBar } from '@/state/BarProvider';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

const BASE_STEPS: ProductSubmissionStatus[] = [
  'draft',
  'submitted',
  'processing',
  'pending_review',
];

const statusLabels: Record<ProductSubmissionStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  processing: 'Simulated extraction',
  pending_review: 'Pending review',
  approved: 'Approved locally',
  merged: 'Merged locally',
  rejected: 'Rejected locally',
};

function statusTone(status: ProductSubmissionStatus): 'neutral' | 'ready' | 'attention' | 'brass' {
  if (status === 'approved' || status === 'merged') return 'ready';
  if (status === 'rejected') return 'attention';
  if (status === 'processing' || status === 'pending_review') return 'brass';
  return 'neutral';
}

function timelineFor(status: ProductSubmissionStatus): ProductSubmissionStatus[] {
  return status === 'approved' || status === 'merged' || status === 'rejected'
    ? [...BASE_STEPS, status]
    : BASE_STEPS;
}

export default function CatalogueReviewScreen() {
  const router = useRouter();
  const { snapshot, advanceProductSubmission, reviewProductSubmission } = useBar();
  const [processingIds, setProcessingIds] = useState<string[]>([]);
  const [processingErrors, setProcessingErrors] = useState<Record<string, string>>({});
  const privateProductById = new Map(snapshot.privateProducts.map((product) => [product.id, product]));
  const sharedSubmissions = snapshot.productSubmissions.filter((submission) => submission.shareConsent);

  const resumeProcessing = async (submissionId: string) => {
    if (processingIds.includes(submissionId)) return;
    setProcessingIds((current) => [...current, submissionId]);
    setProcessingErrors((current) => {
      const next = { ...current };
      delete next[submissionId];
      return next;
    });
    try {
      await advanceProductSubmission(submissionId);
    } catch (error: unknown) {
      setProcessingErrors((current) => ({
        ...current,
        [submissionId]: error instanceof Error ? error.message : 'Simulated extraction did not complete.',
      }));
    } finally {
      setProcessingIds((current) => current.filter((id) => id !== submissionId));
    }
  };

  return (
    <Screen>
      <ScreenScroll contentStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <IconButton
            label="Go back"
            glyph="‹"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/account' as never))}
          />
          <Text style={styles.topLabel}>LOCAL ADMIN PREVIEW</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Eyebrow>Catalogue trust</Eyebrow>
        <Text accessibilityRole="header" style={styles.title}>Review without publishing.</Text>
        <Text style={styles.subtitle}>
          This queue exercises submission and approval states entirely on this device. No product, photo reference,
          barcode or decision reaches a shared catalogue.
        </Text>

        <View style={styles.localNotice} accessibilityRole="summary">
          <Text style={styles.localNoticeGlyph}>i</Text>
          <View style={styles.localNoticeCopy}>
            <Text style={styles.localNoticeTitle}>Simulation boundary</Text>
            <Text style={styles.localNoticeBody}>
              AI extraction is deterministic preview data. Approval buttons update local state only and are not
              administrator authentication.
            </Text>
          </View>
        </View>

        {sharedSubmissions.length === 0 ? (
          <EmptyState
            glyph="⌁"
            title="The local review queue is empty"
            body="Recover an unknown barcode, save it privately, then explicitly submit it to exercise this workflow."
            action={<Button label="Open bottle scanner" onPress={() => router.push('/scan' as never)} />}
          />
        ) : (
          <View style={styles.queue}>
            {sharedSubmissions.map((submission) => {
              const product = privateProductById.get(submission.privateProductId);
              const steps = timelineFor(submission.status);
              const currentIndex = steps.indexOf(submission.status);
              const currentIngredient = product ? ingredientById[product.ingredientId] : undefined;
              const submittedFields = submission.submittedFields ?? submission.extractedFields;
              const submittedIngredient = submittedFields?.ingredientId
                ? ingredientById[submittedFields.ingredientId]
                : undefined;
              const isProcessing = processingIds.includes(submission.id);
              const processingError = processingErrors[submission.id] ?? submission.processingError;
              const schemaStatus = processingError
                ? 'Schema validation: incomplete because processing failed'
                : submission.status === 'processing'
                  ? 'Schema validation: in progress locally'
                  : 'Schema validation: passed locally';

              return (
                <View key={submission.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTitleCopy}>
                      <Text style={styles.cardEyebrow}>PRIVATE PRODUCT SUBMISSION</Text>
                      <Text accessibilityRole="header" style={styles.cardTitle}>
                        {submittedFields?.name ?? product?.name ?? 'Unavailable private product'}
                      </Text>
                    </View>
                    <InlinePill label={statusLabels[submission.status]} tone={statusTone(submission.status)} />
                  </View>

                  {product ? (
                    <View style={styles.metadata}>
                      <Text style={styles.metaSectionLabel}>CURRENT PRIVATE ENTRY</Text>
                      <Text style={styles.metaLine}>
                        {product.brand || 'No brand supplied'}
                        {product.bottleSizeMl ? ` · ${product.bottleSizeMl} ml` : ''}
                      </Text>
                      <Text style={styles.metaLine}>Barcode {product.barcode} · {product.symbology.toUpperCase()}</Text>
                      <Text style={styles.metaLine}>Maps to {currentIngredient?.name ?? product.ingredientId}</Text>
                      <Text style={styles.metaLine}>
                        Current label reference: {product.labelPhotoUri ? 'attached locally' : 'not supplied'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.missingProduct}>The related private product is no longer available.</Text>
                  )}

                  <View style={styles.timeline} accessibilityLabel={`Submission status: ${statusLabels[submission.status]}`}>
                    {steps.map((step, index) => {
                      const reached = index <= currentIndex;
                      const current = step === submission.status;
                      return (
                        <View key={step} style={styles.timelineRow}>
                          <View style={[styles.timelineDot, reached && styles.timelineDotReached, current && styles.timelineDotCurrent]} />
                          <Text style={[styles.timelineLabel, reached && styles.timelineLabelReached]}>{statusLabels[step]}</Text>
                        </View>
                      );
                    })}
                  </View>

                  {submission.modelId ? (
                    <View style={styles.extractionCard}>
                      <Text style={styles.extractionTitle}>Submitted evidence & extraction preview</Text>
                      <Text style={styles.extractionBody}>
                        Submitted bottle: {submittedFields?.brand || 'No brand supplied'}{submittedFields?.name ? ` · ${submittedFields.name}` : ''}{submittedFields?.bottleSizeMl ? ` · ${submittedFields.bottleSizeMl} ml` : ''}
                      </Text>
                      <Text style={styles.extractionBody}>
                        Submitted mapping: {submittedIngredient?.name ?? submittedFields?.ingredientId ?? 'Not captured'}
                      </Text>
                      <Text style={styles.extractionBody}>
                        Submitted label reference: {submission.sourcePhotoUri ? 'attached locally' : 'not supplied'}
                      </Text>
                      <Text style={styles.extractionBody}>Model: {submission.modelId}</Text>
                      <Text style={styles.extractionBody}>
                        Proposed mapping: {submission.extractedFields?.ingredientId
                          ? ingredientById[submission.extractedFields.ingredientId]?.name ?? submission.extractedFields.ingredientId
                          : 'No ingredient proposed'}
                      </Text>
                      <Text style={styles.extractionBody}>{schemaStatus}</Text>
                    </View>
                  ) : null}

                  {processingError ? (
                    <Text accessibilityRole="alert" style={styles.processingError}>{processingError}</Text>
                  ) : null}

                  {submission.status === 'pending_review' ? (
                    <View style={styles.reviewActions}>
                      <Button
                        label="Approve locally"
                        onPress={() => reviewProductSubmission(submission.id, 'approved')}
                      />
                      <Button
                        label="Merge locally"
                        variant="secondary"
                        onPress={() => reviewProductSubmission(submission.id, 'merged')}
                      />
                      <Button
                        label="Reject locally"
                        variant="danger"
                        onPress={() => reviewProductSubmission(submission.id, 'rejected')}
                      />
                    </View>
                  ) : submission.status === 'submitted' || submission.status === 'processing' ? (
                    <View style={styles.resumeSection}>
                      <Text style={styles.decisionNote}>
                        {isProcessing
                          ? 'The deterministic local extraction is running now.'
                          : 'The private bottle remains usable. Resume this interrupted local job whenever you are ready.'}
                      </Text>
                      <Button
                        label={isProcessing ? 'Processing locally…' : 'Resume simulated extraction'}
                        variant="secondary"
                        disabled={isProcessing}
                        onPress={() => void resumeProcessing(submission.id)}
                      />
                    </View>
                  ) : (
                    <Text style={styles.decisionNote}>
                      {submission.status === 'draft'
                        ? 'This draft has not been shared with the local review simulation.'
                        : 'This decision remains local and can be recreated by scanning another unknown fixture.'}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: spacing.huge },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, marginBottom: spacing.xxxl },
  topLabel: { color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.4 },
  headerSpacer: { width: 44 },
  title: { color: colors.paper, fontFamily: fonts.display, fontSize: 42, lineHeight: 48, marginTop: spacing.sm, maxWidth: 650 },
  subtitle: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 22, marginTop: spacing.md, maxWidth: 650 },
  localNotice: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xxl, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(215,170,98,0.24)', backgroundColor: colors.brassSoft },
  localNoticeGlyph: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.brass, color: colors.ink, textAlign: 'center', lineHeight: 26, fontFamily: fonts.bodyMedium, fontSize: 13 },
  localNoticeCopy: { flex: 1 },
  localNoticeTitle: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 13 },
  localNoticeBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 11, lineHeight: 17, marginTop: 4 },
  queue: { gap: spacing.lg, marginTop: spacing.xxxl },
  card: { padding: spacing.xl, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface },
  cardHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  cardTitleCopy: { flex: 1, minWidth: 200 },
  cardEyebrow: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.1 },
  cardTitle: { color: colors.paper, fontFamily: fonts.display, fontSize: 26, lineHeight: 32, marginTop: 5 },
  metadata: { gap: 5, marginTop: spacing.lg },
  metaSectionLabel: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1 },
  metaLine: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  missingProduct: { color: colors.alert, fontFamily: fonts.body, fontSize: 12, lineHeight: 18, marginTop: spacing.lg },
  timeline: { gap: spacing.sm, marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  timelineRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  timelineDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.paperDim, backgroundColor: colors.inkRaised },
  timelineDotReached: { borderColor: colors.brass, backgroundColor: colors.brassSoft },
  timelineDotCurrent: { backgroundColor: colors.brass },
  timelineLabel: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11 },
  timelineLabelReached: { color: colors.paperMuted },
  extractionCard: { gap: 5, marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.inkRaised },
  extractionTitle: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 12 },
  extractionBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 11, lineHeight: 17 },
  processingError: { color: colors.alert, fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 18, marginTop: spacing.lg },
  reviewActions: { gap: spacing.sm, marginTop: spacing.xl },
  resumeSection: { gap: spacing.md, marginTop: spacing.xl },
  decisionNote: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, lineHeight: 17, marginTop: spacing.xl },
});
