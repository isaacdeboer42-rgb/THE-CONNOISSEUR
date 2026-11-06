import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Eyebrow, IconButton, Screen, ScreenScroll } from '@/components/ui';
import { useBar } from '@/state/BarProvider';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

const preferenceMeta = {
  sweet: { label: 'Sweet', glyph: '◇', description: 'Round, rich and dessert-like flavours.' },
  sour: { label: 'Sour', glyph: '◒', description: 'Fresh acidity and a brighter finish.' },
  salty: { label: 'Salty', glyph: '≈', description: 'Savoury lift and mineral character.' },
  bitter: { label: 'Bitter', glyph: '✦', description: 'Aperitif bite, bitters and herbal depth.' },
  fruity: { label: 'Fruity', glyph: '●', description: 'Juicy, aromatic fruit character.' },
  spiritForward: { label: 'Spirit-forward', glyph: '△', description: 'Bold pours with less softening sweetness.' },
} as const;

type TasteDimension = keyof typeof preferenceMeta;

const intensityOptions = [
  { label: 'Low', value: 0.25 },
  { label: 'Medium', value: 0.55 },
  { label: 'High', value: 0.85 },
] as const;

const importanceOptions = [
  { label: 'A little', value: 0.35 },
  { label: 'Matters', value: 0.7 },
  { label: 'Essential', value: 1 },
] as const;

function ChoiceRow({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: ReadonlyArray<{ label: string; value: number }>;
  selected: number;
  onSelect: (value: number) => void;
}) {
  return (
    <View style={styles.choiceGroup}>
      <Text style={styles.choiceLabel}>{label}</Text>
      <View style={styles.segmented}>
        {options.map((option) => {
          const active = option.value === selected;
          return (
            <Pressable
              key={option.label}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${label}: ${option.label}`}
              onPress={() => onSelect(option.value)}
              style={({ pressed }) => [styles.segment, active && styles.segmentActive, pressed && styles.pressed]}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function PreferencesScreen() {
  const router = useRouter();
  const { snapshot, setPersistentPreference } = useBar();
  const dimensions = Object.keys(preferenceMeta) as TasteDimension[];
  const configuredCount = dimensions.filter((dimension) => Boolean(snapshot.tastePreferences[dimension])).length;

  return (
    <Screen>
      <ScreenScroll contentStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <IconButton label="Go back" glyph="‹" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/tonight')} />
          <Text style={styles.topLabel}>TASTE PROFILE</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Eyebrow>Permanent preferences</Eyebrow>
        <Text accessibilityRole="header" style={styles.title}>What tastes like you?</Text>
        <Text style={styles.subtitle}>
          Set only what matters. Unspecified flavours stay neutral, and tonight’s choices can temporarily override these.
        </Text>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryValue}>{configuredCount}</Text>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryTitle}>{configuredCount === 1 ? 'preference set' : 'preferences set'}</Text>
            <Text style={styles.summaryBody}>You can leave every dimension neutral and still receive availability-first recommendations.</Text>
          </View>
        </View>

        <View style={styles.list}>
          {dimensions.map((dimension) => {
            const meta = preferenceMeta[dimension];
            const preference = snapshot.tastePreferences[dimension];
            const value = preference ?? { intensity: 0.55, importance: 0.7 };
            return (
              <View key={dimension} style={[styles.preferenceCard, preference && styles.preferenceCardActive]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.glyphCircle, preference && styles.glyphCircleActive]}>
                    <Text style={[styles.glyph, preference && styles.glyphActive]}>{meta.glyph}</Text>
                  </View>
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardTitle}>{meta.label}</Text>
                    <Text style={styles.cardDescription}>{meta.description}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={preference ? `Clear ${meta.label} preference` : `Enable ${meta.label} preference`}
                    onPress={() =>
                      setPersistentPreference(
                        dimension,
                        preference ? undefined : { intensity: value.intensity, importance: value.importance },
                      )
                    }
                    style={({ pressed }) => [styles.toggle, preference && styles.toggleActive, pressed && styles.pressed]}
                  >
                    <Text style={[styles.toggleText, preference && styles.toggleTextActive]}>{preference ? 'Set' : 'Add'}</Text>
                  </Pressable>
                </View>

                {preference ? (
                  <View style={styles.controls}>
                    <ChoiceRow
                      label="Preferred intensity"
                      options={intensityOptions}
                      selected={value.intensity}
                      onSelect={(intensity) => setPersistentPreference(dimension, { ...value, intensity })}
                    />
                    <ChoiceRow
                      label="How much it matters"
                      options={importanceOptions}
                      selected={value.importance}
                      onSelect={(importance) => setPersistentPreference(dimension, { ...value, importance })}
                    />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={styles.footerActions}>
          <Button label="Done" onPress={() => router.back()} />
          {configuredCount ? (
            <Button
              label="Clear all preferences"
              variant="ghost"
              onPress={() => dimensions.forEach((dimension) => setPersistentPreference(dimension, undefined))}
            />
          ) : null}
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
  title: { color: colors.paper, fontFamily: fonts.display, fontSize: 43, lineHeight: 49, marginTop: spacing.sm },
  subtitle: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 15, lineHeight: 23, maxWidth: 590, marginTop: spacing.md },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.xxl, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(215,170,98,0.2)', backgroundColor: colors.surfaceWarm, padding: spacing.lg },
  summaryValue: { minWidth: 48, color: colors.brass, fontFamily: fonts.display, fontSize: 38, textAlign: 'center' },
  summaryCopy: { flex: 1 },
  summaryTitle: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 13 },
  summaryBody: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, lineHeight: 17, marginTop: 4 },
  list: { gap: spacing.md, marginTop: spacing.xxxl },
  preferenceCard: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, padding: spacing.lg },
  preferenceCardActive: { borderColor: 'rgba(215,170,98,0.28)', backgroundColor: colors.surfaceWarm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  glyphCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSoft },
  glyphCircleActive: { backgroundColor: colors.brassSoft },
  glyph: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 17 },
  glyphActive: { color: colors.brass },
  cardCopy: { flex: 1 },
  cardTitle: { color: colors.paper, fontFamily: fonts.display, fontSize: 21 },
  cardDescription: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 10, lineHeight: 15, marginTop: 2 },
  toggle: { minWidth: 58, minHeight: 38, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.divider, alignItems: 'center', justifyContent: 'center' },
  toggleActive: { borderColor: 'rgba(169,214,141,0.28)', backgroundColor: colors.readyDeep },
  toggleText: { color: colors.paperMuted, fontFamily: fonts.bodyMedium, fontSize: 10 },
  toggleTextActive: { color: colors.ready },
  controls: { gap: spacing.lg, paddingTop: spacing.lg, marginTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider },
  choiceGroup: { gap: spacing.sm },
  choiceLabel: { color: colors.paperMuted, fontFamily: fonts.bodyMedium, fontSize: 10, letterSpacing: 0.4 },
  segmented: { flexDirection: 'row', padding: 3, borderRadius: radius.pill, backgroundColor: colors.inkRaised },
  segment: { flex: 1, minHeight: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  segmentActive: { backgroundColor: colors.surfaceSoft },
  segmentText: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 10 },
  segmentTextActive: { color: colors.brass, fontFamily: fonts.bodyMedium },
  footerActions: { gap: spacing.sm, marginTop: spacing.xxxl },
  pressed: { opacity: 0.72 },
});
