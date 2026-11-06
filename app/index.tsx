import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { Button, ConnoisseurMark, DisplayText, LoadingState, Screen, ScreenScroll } from '@/components/ui';
import { iceChoicesConfirmed } from '@/domain/onboarding';
import { useBar } from '@/state/BarProvider';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

function CocktailStillLife({ wide }: { wide: boolean }) {
  return (
    <View style={[styles.stillLife, wide && styles.stillLifeWide]} accessible={false}>
      <View style={styles.haloLarge} />
      <View style={styles.haloSmall} />
      <View style={styles.glassStem} />
      <View style={styles.glassBowl}>
        <View style={styles.drink} />
      </View>
      <View style={styles.glassBase} />
      <View style={styles.lemon}>
        <View style={styles.lemonInner} />
      </View>
      <View style={styles.sparkOne} />
      <View style={styles.sparkTwo} />
    </View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { hydration, mode, snapshot, accountProfile, activateGuest, activateSample } = useBar();

  if (hydration === 'loading') return <LoadingState />;

  const wide = width >= 800;
  const iceConfirmed = iceChoicesConfirmed(snapshot.basics);
  const readyForTonight = snapshot.hasOnboarded && iceConfirmed;

  return (
    <Screen>
      <ScreenScroll contentStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <ConnoisseurMark />
          <View style={styles.guestPill}>
            <View style={styles.guestDot} />
            <Text style={styles.guestText}>{accountProfile ? 'Account bar' : mode === 'sample' ? 'Sample bar' : 'Guest mode'}</Text>
          </View>
        </View>

        <View style={[styles.hero, wide && styles.heroWide]}>
          <View style={[styles.heroCopy, wide && styles.heroCopyWide]}>
            <Text style={styles.kicker}>MAKE SOMETHING WORTH SIPPING</Text>
            <DisplayText style={styles.title}>
              A better drink is <Text style={styles.titleAccent}>already</Text> in your bar.
            </DisplayText>
            <Text style={styles.body}>
              Tell us what is on your shelf. We will find the cocktails that fit, explain what is missing, and guide every pour.
            </Text>

            <View style={styles.actions}>
              {readyForTonight ? (
                <Button label="Return to tonight" onPress={() => router.replace('/(tabs)/tonight')} />
              ) : (
                <Button
                  label={snapshot.hasOnboarded ? 'Confirm ice to continue' : 'Build my bar'}
                  onPress={() => {
                    if (mode === 'sample') activateGuest();
                    router.push('/setup');
                  }}
                />
              )}
              <Button
                label={snapshot.hasOnboarded ? 'Edit my bar' : 'Explore a sample bar'}
                variant="secondary"
                onPress={() => {
                  if (snapshot.hasOnboarded) {
                    if (mode !== 'account') activateGuest();
                    router.push('/setup');
                  } else {
                    activateSample();
                    router.replace('/(tabs)/tonight');
                  }
                }}
              />
            </View>

            <View style={styles.reassurance}>
              <Text style={styles.reassuranceIcon}>⌁</Text>
              <Text style={styles.reassuranceText}>{accountProfile ? 'Your local preview account is active.' : 'No account needed. Your guest bar stays on this device.'}</Text>
            </View>
          </View>

          <CocktailStillLife wide={wide} />
        </View>

        <View style={styles.promiseRow}>
          <View style={styles.promiseItem}>
            <Text style={styles.promiseNumber}>01</Text>
            <View>
              <Text style={styles.promiseTitle}>Add what you own</Text>
              <Text style={styles.promiseBody}>Ingredients or bottles</Text>
            </View>
          </View>
          <View style={styles.promiseDivider} />
          <View style={styles.promiseItem}>
            <Text style={styles.promiseNumber}>02</Text>
            <View>
              <Text style={styles.promiseTitle}>See honest matches</Text>
              <Text style={styles.promiseBody}>Ready, substituted or missing</Text>
            </View>
          </View>
          <View style={styles.promiseDivider} />
          <View style={styles.promiseItem}>
            <Text style={styles.promiseNumber}>03</Text>
            <View>
              <Text style={styles.promiseTitle}>Make it well</Text>
              <Text style={styles.promiseBody}>One calm step at a time</Text>
            </View>
          </View>
        </View>
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: spacing.xxxl },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.lg, marginBottom: spacing.xxl },
  guestPill: { flexDirection: 'row', alignItems: 'center', minHeight: 32, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.divider, gap: 7 },
  guestDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.ready },
  guestText: { color: colors.paperMuted, fontFamily: fonts.bodyMedium, fontSize: 11 },
  hero: { flex: 1, minHeight: 570, justifyContent: 'space-between' },
  heroWide: { minHeight: 540, flexDirection: 'row', alignItems: 'center', gap: spacing.xxxl },
  heroCopy: { zIndex: 2, paddingTop: spacing.xxl },
  heroCopyWide: { flex: 1, paddingTop: 0 },
  kicker: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 2, marginBottom: spacing.lg },
  title: { maxWidth: 620, fontSize: 50, lineHeight: 55 },
  titleAccent: { color: colors.brass, fontStyle: 'italic' },
  body: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 16, lineHeight: 25, maxWidth: 540, marginTop: spacing.xl },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xxxl },
  reassurance: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  reassuranceIcon: { color: colors.ready, fontFamily: fonts.body, fontSize: 18 },
  reassuranceText: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11 },
  stillLife: { height: 250, minWidth: 280, width: '100%', flexShrink: 0, marginTop: spacing.xxxl, overflow: 'hidden' },
  stillLifeWide: { width: 280, marginTop: 0 },
  haloLarge: { position: 'absolute', right: -40, top: -5, width: 235, height: 235, borderRadius: 118, backgroundColor: colors.brassSoft, opacity: 0.65 },
  haloSmall: { position: 'absolute', right: 68, top: 36, width: 130, height: 130, borderRadius: 65, borderWidth: 1, borderColor: 'rgba(215,170,98,0.28)' },
  glassBowl: { position: 'absolute', right: 64, top: 34, width: 150, height: 92, borderBottomLeftRadius: 82, borderBottomRightRadius: 82, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderWidth: 2, borderColor: 'rgba(244,240,231,0.65)', overflow: 'hidden' },
  drink: { position: 'absolute', left: 5, right: 5, bottom: 5, height: 49, backgroundColor: 'rgba(215,170,98,0.42)', borderBottomLeftRadius: 72, borderBottomRightRadius: 72 },
  glassStem: { position: 'absolute', right: 138, top: 125, width: 2, height: 62, backgroundColor: 'rgba(244,240,231,0.55)' },
  glassBase: { position: 'absolute', right: 91, top: 186, width: 96, height: 2, backgroundColor: 'rgba(244,240,231,0.55)' },
  lemon: { position: 'absolute', right: 43, top: 30, width: 55, height: 28, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.citrus, transform: [{ rotate: '18deg' }], overflow: 'hidden' },
  lemonInner: { position: 'absolute', left: 5, right: 5, top: 5, bottom: -5, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: 'rgba(11,14,13,0.35)' },
  sparkOne: { position: 'absolute', right: 244, top: 55, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.brass },
  sparkTwo: { position: 'absolute', right: 30, top: 145, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.paperDim },
  promiseRow: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.xl, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  promiseItem: { minWidth: 180, flex: 1, flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  promiseNumber: { color: colors.brass, fontFamily: fonts.display, fontSize: 18 },
  promiseTitle: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 12 },
  promiseBody: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, marginTop: 3 },
  promiseDivider: { width: 1, minHeight: 42, backgroundColor: colors.divider },
});
