import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Eyebrow, IconButton, Screen, ScreenScroll } from '@/components/ui';
import { useBar } from '@/state/BarProvider';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

export default function RegisterScreen() {
  const router = useRouter();
  const { registerAccount } = useBar();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const result = await registerAccount(email);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.replace('/account' as never);
  };

  return (
    <AccountFormShell title="Create a local preview." eyebrow="Preview account" onBack={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/bar')}>
      <Text style={styles.body}>Your guest inventory, saves, preferences, shopping and feedback are copied with a stable import ID. The guest source is retained on this device.</Text>
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Button label={busy ? 'Creating…' : 'Continue with preview account'} disabled={busy} onPress={() => void submit()} />
      <Text style={styles.localNote}>No password is requested or stored. This creates a local UX preview only; no account or data is sent to a server.</Text>
    </AccountFormShell>
  );
}

function AccountFormShell({ title, eyebrow, onBack, children }: { title: string; eyebrow: string; onBack: () => void; children: React.ReactNode }) {
  return <Screen><ScreenScroll contentStyle={styles.scroll}><View style={styles.topBar}><IconButton label="Go back" glyph="‹" onPress={onBack} /><Text style={styles.topLabel}>ACCOUNT</Text><View style={styles.spacer} /></View><Eyebrow>{eyebrow}</Eyebrow><Text accessibilityRole="header" style={styles.title}>{title}</Text><View style={styles.form}>{children}</View></ScreenScroll></Screen>;
}

function Field({ label, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} accessibilityLabel={label} placeholderTextColor={colors.paperDim} style={styles.input} /></View>;
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.huge },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, marginBottom: spacing.xxxl },
  topLabel: { color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.4 },
  spacer: { width: 44 },
  title: { color: colors.paper, fontFamily: fonts.display, fontSize: 43, lineHeight: 49, marginTop: spacing.sm },
  form: { gap: spacing.lg, marginTop: spacing.xxl },
  body: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 22 },
  field: { gap: spacing.sm },
  label: { color: colors.paperMuted, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  input: { minHeight: 54, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, color: colors.paper, fontFamily: fonts.body, fontSize: 14, paddingHorizontal: spacing.lg },
  error: { color: colors.alert, fontFamily: fonts.body, fontSize: 11 },
  localNote: { color: colors.paperDim, fontFamily: fonts.body, fontSize: 11, lineHeight: 17, textAlign: 'center' },
});
