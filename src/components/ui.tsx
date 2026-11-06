import React, { PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, contentMaxWidth, fonts, radius, spacing } from '@/theme/tokens';

export function Screen({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <SafeAreaView style={[styles.safe, style]}>{children}</SafeAreaView>;
}

export function ScreenScroll({
  children,
  contentStyle,
  testID,
}: PropsWithChildren<{ contentStyle?: StyleProp<ViewStyle>; testID?: string }>) {
  return (
    <ScrollView
      testID={testID}
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>{children}</View>
    </ScrollView>
  );
}

export function DisplayText({ children, style }: PropsWithChildren<{ style?: StyleProp<TextStyle> }>) {
  return <Text style={[styles.display, style]}>{children}</Text>;
}

export function Eyebrow({ children, style }: PropsWithChildren<{ style?: StyleProp<TextStyle> }>) {
  return <Text style={[styles.eyebrow, style]}>{children}</Text>;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}`],
        pressed && !disabled && styles.buttonPressed,
        disabled && styles.buttonDisabled,
        style,
      ]}
    >
      <Text style={[styles.buttonLabel, styles[`buttonLabel_${variant}`]]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ label, glyph, onPress }: { label: string; glyph: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed]}
    >
      <Text style={styles.iconGlyph}>{glyph}</Text>
    </Pressable>
  );
}

export function ConnoisseurMark({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.markRow, compact && styles.markRowCompact]} accessibilityLabel="The Connoisseur">
      <View style={[styles.markCircle, compact && styles.markCircleCompact]}>
        <Text style={[styles.markLetter, compact && styles.markLetterCompact]}>C</Text>
        <View style={styles.markDot} />
      </View>
      {!compact && (
        <View>
          <Text style={styles.wordmark}>THE CONNOISSEUR</Text>
          <Text style={styles.wordmarkSub}>YOUR HOME BAR, BETTER USED</Text>
        </View>
      )}
    </View>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeading}>
      <View style={styles.sectionHeadingCopy}>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {title}
        </Text>
      </View>
      {action}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export function LoadingState() {
  return (
    <Screen style={styles.loading}>
      <ConnoisseurMark />
      <ActivityIndicator color={colors.brass} size="small" style={styles.loader} />
      <Text style={styles.loadingText}>Opening your bar…</Text>
    </Screen>
  );
}

export function InlinePill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'ready' | 'attention' | 'brass';
}) {
  return (
    <View style={[styles.pill, styles[`pill_${tone}`]]}>
      <View style={[styles.pillDot, styles[`pillDot_${tone}`]]} />
      <Text style={[styles.pillText, styles[`pillText_${tone}`]]}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  glyph,
  title,
  body,
  action,
}: {
  glyph: string;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyGlyph}>{glyph}</Text>
      <Text accessibilityRole="header" style={styles.emptyTitle}>
        {title}
      </Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: 120 },
  content: { width: '100%', maxWidth: contentMaxWidth, alignSelf: 'center' },
  display: {
    color: colors.paper,
    fontFamily: fonts.display,
    fontSize: 44,
    lineHeight: 49,
    letterSpacing: -1.2,
  },
  eyebrow: {
    color: colors.brass,
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  button: {
    minHeight: 52,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  button_primary: { backgroundColor: colors.brass, borderColor: colors.brass },
  button_secondary: { backgroundColor: colors.surfaceSoft, borderColor: colors.divider },
  button_ghost: { backgroundColor: 'transparent', borderColor: colors.divider },
  button_danger: { backgroundColor: colors.alertDeep, borderColor: 'rgba(240,161,113,0.35)' },
  buttonPressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  buttonDisabled: { opacity: 0.38 },
  buttonLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 20, letterSpacing: 0.2 },
  buttonLabel_primary: { color: colors.ink },
  buttonLabel_secondary: { color: colors.paper },
  buttonLabel_ghost: { color: colors.paperMuted },
  buttonLabel_danger: { color: colors.alert },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: { color: colors.paper, fontFamily: fonts.body, fontSize: 20 },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  markRowCompact: { gap: 0 },
  markCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.brass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markCircleCompact: { width: 40, height: 40, borderRadius: 20 },
  markLetter: { color: colors.paper, fontFamily: fonts.display, fontSize: 28, marginTop: -2 },
  markLetterCompact: { fontSize: 23 },
  markDot: { position: 'absolute', right: -2, top: 8, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.brass },
  wordmark: { color: colors.paper, fontFamily: fonts.bodyMedium, fontSize: 12, letterSpacing: 2.1 },
  wordmarkSub: { marginTop: 3, color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, letterSpacing: 1.2 },
  sectionHeading: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.lg },
  sectionHeadingCopy: { flex: 1, gap: 3 },
  sectionTitle: { color: colors.paper, fontFamily: fonts.display, fontSize: 28, lineHeight: 34 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.divider },
  loading: { alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  loader: { marginTop: spacing.xxxl },
  loadingText: { marginTop: spacing.md, color: colors.paperMuted, fontFamily: fonts.body, fontSize: 14 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: 30,
    paddingHorizontal: 11,
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: 7,
  },
  pill_neutral: { backgroundColor: colors.surfaceSoft, borderColor: colors.divider },
  pill_ready: { backgroundColor: colors.readyDeep, borderColor: 'rgba(169,214,141,0.24)' },
  pill_attention: { backgroundColor: colors.alertDeep, borderColor: 'rgba(240,161,113,0.24)' },
  pill_brass: { backgroundColor: colors.brassSoft, borderColor: 'rgba(215,170,98,0.24)' },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillDot_neutral: { backgroundColor: colors.paperDim },
  pillDot_ready: { backgroundColor: colors.ready },
  pillDot_attention: { backgroundColor: colors.alert },
  pillDot_brass: { backgroundColor: colors.brass },
  pillText: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 15 },
  pillText_neutral: { color: colors.paperMuted },
  pillText_ready: { color: colors.ready },
  pillText_attention: { color: colors.alert },
  pillText_brass: { color: colors.brass },
  emptyState: {
    backgroundColor: colors.surface,
    borderColor: colors.divider,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.xxxl,
    alignItems: 'center',
  },
  emptyGlyph: { color: colors.brass, fontSize: 30, marginBottom: spacing.lg },
  emptyTitle: { color: colors.paper, fontFamily: fonts.display, fontSize: 25, textAlign: 'center' },
  emptyBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: spacing.sm, maxWidth: 420 },
  emptyAction: { marginTop: spacing.xl, width: '100%', maxWidth: 320 },
});
