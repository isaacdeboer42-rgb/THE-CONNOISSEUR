import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Eyebrow, IconButton, Screen, ScreenScroll } from '@/components/ui';
import { recipes } from '@/data/catalog';
import { useBar } from '@/state/BarProvider';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

const facts = [
  ['Storage', 'Inventory, saves, preferences, private bottle records and tasting notes stay in local app storage.'],
  ['Network', 'Discover reads a public cocktail catalogue from Mixology Tools. Search text is sent to that service; your bar, saves, private bottles and tasting notes are not. No analytics service is connected.'],
  ['Photos', 'Label-photo references are local URIs. They are not uploaded by this build.'],
  ['Accounts', 'Account and recovery screens are a local migration preview, not authentication or cloud backup.'],
  ['Deletion', 'Reset guest bar clears guest data. Uninstalling the app clears its local storage; preview-account deletion requires a production identity service.'],
] as const;

export default function AboutScreen() {
  const router = useRouter();
  const { snapshot } = useBar();
  const version = Constants.expoConfig?.version ?? 'development';

  return (
    <Screen>
      <ScreenScroll contentStyle={styles.content}>
        <View style={styles.topBar}>
          <IconButton label="Go back" glyph="‹" onPress={() => router.back()} />
          <Text style={styles.topLabel}>ABOUT & PRIVACY</Text>
          <View style={styles.spacer} />
        </View>
        <Eyebrow>Release candidate · Version {version}</Eyebrow>
        <Text accessibilityRole="header" style={styles.title}>Know what this build does.</Text>
        <Text style={styles.subtitle}>
          The Connoisseur is a local-first release candidate. Its recommendation, shopping, Make mode and catalogue-review flows are testable without implying that production services are connected.
        </Text>

        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>This device</Text>
          <Text style={styles.statusBody}>{snapshot.inventory.length} inventory items · {snapshot.savedRecipes.length} saved recipes · {snapshot.makeSessions.length} make sessions</Text>
          <Text style={styles.statusBody}>{recipes.length} published Connoisseur recipes with editorial review metadata</Text>
          <Text style={styles.statusBody}>The broad external catalogue is loaded on demand and is clearly separated from reviewed Make recipes.</Text>
        </View>

        <View style={styles.list}>
          {facts.map(([title, body]) => (
            <View key={title} style={styles.row}>
              <Text style={styles.rowTitle}>{title}</Text>
              <Text style={styles.rowBody}>{body}</Text>
            </View>
          ))}
        </View>

        <View style={styles.warning}>
          <Text style={styles.warningTitle}>Before a public launch</Text>
          <Text style={styles.warningBody}>Production authentication, row-level data ownership, private object storage, provider rate limits, backups, account deletion and store privacy declarations must be configured and verified. Do not treat this local preview as a cloud backup.</Text>
        </View>
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.huge },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, marginBottom: spacing.xxxl },
  topLabel: { color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.4 },
  spacer: { width: 44 },
  title: { color: colors.paper, fontFamily: fonts.display, fontSize: 43, lineHeight: 49, marginTop: spacing.sm, maxWidth: 620 },
  subtitle: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 15, lineHeight: 23, marginTop: spacing.md, maxWidth: 620 },
  statusCard: { marginTop: spacing.xxxl, gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(169,214,141,0.22)', backgroundColor: colors.readyDeep },
  statusTitle: { color: colors.ready, fontFamily: fonts.bodyMedium, fontSize: 12 },
  statusBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 11, lineHeight: 17 },
  list: { marginTop: spacing.xxl },
  row: { paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  rowTitle: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 13 },
  rowBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 12, lineHeight: 19, marginTop: spacing.sm, maxWidth: 620 },
  warning: { marginTop: spacing.xxxl, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.alertDeep, borderWidth: 1, borderColor: 'rgba(240,161,113,0.22)' },
  warningTitle: { color: colors.alert, fontFamily: fonts.bodyMedium, fontSize: 12 },
  warningBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 11, lineHeight: 17, marginTop: spacing.sm },
});
