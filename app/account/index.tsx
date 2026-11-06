import { useRouter } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { Button, Eyebrow, IconButton, InlinePill, Screen, ScreenScroll } from '@/components/ui';
import { useBar } from '@/state/BarProvider';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

export default function AccountScreen() {
  const router = useRouter();
  const { accountProfile, importState, retryGuestImport, signOut, resetGuest } = useBar();

  const confirmGuestReset = () => {
    Alert.alert(
      'Reset the guest bar?',
      'This clears the separate guest inventory, saves, preferences, shopping and make sessions. A preview-account copy is not changed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset guest bar', style: 'destructive', onPress: resetGuest },
      ],
    );
  };

  return (
    <Screen>
      <ScreenScroll contentStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <IconButton label="Go back" glyph="‹" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/bar')} />
          <Text style={styles.topLabel}>ACCOUNT & DATA</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Eyebrow>{accountProfile ? 'Your bar, remembered' : 'Optional account'}</Eyebrow>
        <Text accessibilityRole="header" style={styles.title}>
          {accountProfile ? 'Your bar has a home.' : 'Keep the guest experience. Add backup later.'}
        </Text>
        <Text style={styles.subtitle}>
          {accountProfile
            ? 'Your account copy and original guest bar are stored separately on this device.'
            : 'Create an account only when backup and device synchronisation are useful to you.'}
        </Text>

        <View style={styles.previewNotice}>
          <Text style={styles.previewGlyph}>i</Text>
          <View style={styles.previewCopy}>
            <Text style={styles.previewTitle}>Local account preview</Text>
            <Text style={styles.previewBody}>Supabase is not configured in this build. Account screens and idempotent guest migration are testable, but no credentials or data leave this device.</Text>
          </View>
        </View>

        {accountProfile ? (
          <>
            <View style={styles.accountCard}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{accountProfile.email.charAt(0).toUpperCase()}</Text></View>
              <View style={styles.accountCopy}>
                <Text style={styles.email}>{accountProfile.email}</Text>
                <Text style={styles.accountMeta}>Preview account · Created {new Date(accountProfile.createdAt).toLocaleDateString()}</Text>
              </View>
              <InlinePill label="Signed in" tone="ready" />
            </View>

            <View style={styles.importCard}>
              <View style={styles.importHeader}>
                <Text style={styles.importTitle}>Guest data migration</Text>
                <InlinePill
                  label={importState.status === 'confirmed' ? 'Confirmed' : importState.status}
                  tone={importState.status === 'confirmed' ? 'ready' : importState.status === 'failed' ? 'attention' : 'brass'}
                />
              </View>
              {importState.status === 'confirmed' ? (
                <Text style={styles.importBody}>
                  {importState.mergedInventoryCount ?? 0} inventory items · {importState.mergedSavedCount ?? 0} saves · {importState.mergedShoppingCount ?? 0} shopping items copied. The guest source remains intact.
                </Text>
              ) : importState.status === 'failed' ? (
                <>
                  <Text style={styles.importError}>{importState.error ?? 'Import needs another attempt.'}</Text>
                  <Button label="Retry guest import" variant="secondary" onPress={() => void retryGuestImport()} />
                </>
              ) : (
                <Text style={styles.importBody}>The guest import has not completed yet.</Text>
              )}
            </View>

            <View style={styles.actions}>
              <Button label="Edit taste profile" variant="secondary" onPress={() => router.push('/preferences')} />
              <Button label="Open shopping" variant="secondary" onPress={() => router.push('/shopping')} />
              <Button label="Sign out" variant="ghost" onPress={signOut} />
            </View>
          </>
        ) : (
          <View style={styles.actions}>
            <Button label="Create preview account" onPress={() => router.push('/account/register')} />
            <Button label="Sign in" variant="secondary" onPress={() => router.push('/account/sign-in')} />
            <Button label="Recover access" variant="ghost" onPress={() => router.push('/account/recovery')} />
          </View>
        )}

        <View style={styles.dataSection}>
          <Text style={styles.dataTitle}>Guest data on this device</Text>
          <Text style={styles.dataBody}>Use this when you want to repeat onboarding from a clean local state.</Text>
          <Button label="Reset guest bar" variant="danger" onPress={confirmGuestReset} />
        </View>
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: spacing.huge },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, marginBottom: spacing.xxxl },
  topLabel: { color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 8, letterSpacing: 1.4 },
  headerSpacer: { width: 44 },
  title: { color: colors.paper, fontFamily: fonts.display, fontSize: 43, lineHeight: 49, marginTop: spacing.sm, maxWidth: 650 },
  subtitle: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 15, lineHeight: 23, maxWidth: 590, marginTop: spacing.md },
  previewNotice: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xxl, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(215,170,98,0.2)', backgroundColor: colors.brassSoft, padding: spacing.lg },
  previewGlyph: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brass, color: colors.ink, textAlign: 'center', lineHeight: 24, fontFamily: fonts.bodyMedium, fontSize: 12 },
  previewCopy: { flex: 1 },
  previewTitle: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 12 },
  previewBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 10, lineHeight: 16, marginTop: 4 },
  accountCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xxxl, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, padding: spacing.lg },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceWarm, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.brass, fontFamily: fonts.display, fontSize: 23 },
  accountCopy: { flex: 1 },
  email: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 13 },
  accountMeta: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 9, marginTop: 4 },
  importCard: { gap: spacing.md, marginTop: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, padding: spacing.lg },
  importHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  importTitle: { color: colors.paper, fontFamily: fonts.display, fontSize: 21 },
  importBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 11, lineHeight: 17 },
  importError: { color: colors.alert, fontFamily: fonts.body, fontSize: 11, lineHeight: 17 },
  actions: { gap: spacing.sm, marginTop: spacing.xxxl },
  dataSection: { gap: spacing.md, marginTop: spacing.huge, paddingTop: spacing.xl, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  dataTitle: { color: colors.paper, fontFamily: fonts.display, fontSize: 20 },
  dataBody: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 10, lineHeight: 16 },
});
