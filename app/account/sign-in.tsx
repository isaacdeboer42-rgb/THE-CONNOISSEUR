import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Eyebrow, IconButton, Screen, ScreenScroll } from '@/components/ui';
import { useBar } from '@/state/BarProvider';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn } = useBar();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const result = await signIn(email, password);
    setBusy(false);
    if (!result.ok) setError(result.error);
    else router.replace('/(tabs)/tonight');
  };

  return (
    <Screen>
      <ScreenScroll contentStyle={styles.scroll}>
        <View style={styles.topBar}><IconButton label="Go back" glyph="‹" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/bar')} /><Text style={styles.topLabel}>ACCOUNT</Text><View style={styles.spacer} /></View>
        <Eyebrow>Welcome back</Eyebrow>
        <Text accessibilityRole="header" style={styles.title}>Return to your bar.</Text>
        <Text style={styles.body}>This preview signs in only to the local account created on this device. Server authentication is not configured yet.</Text>
        <View style={styles.form}>
          <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <Button label={busy ? 'Signing in…' : 'Sign in'} disabled={busy} onPress={() => void submit()} />
          <Button label="Forgot password?" variant="ghost" onPress={() => router.push('/account/recovery')} />
        </View>
      </ScreenScroll>
    </Screen>
  );
}

function Field({ label, ...props }: React.ComponentProps<typeof TextInput> & { label: string }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...props} accessibilityLabel={label} placeholderTextColor={colors.paperDim} style={styles.input} /></View>;
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.huge },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, marginBottom: spacing.xxxl },
  topLabel: { color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 8, letterSpacing: 1.4 },
  spacer: { width: 44 },
  title: { color: colors.paper, fontFamily: fonts.display, fontSize: 43, lineHeight: 49, marginTop: spacing.sm },
  body: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 22, marginTop: spacing.md },
  form: { gap: spacing.lg, marginTop: spacing.xxl },
  field: { gap: spacing.sm },
  label: { color: colors.paperMuted, fontFamily: fonts.bodyMedium, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
  input: { minHeight: 54, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, color: colors.paper, fontFamily: fonts.body, fontSize: 14, paddingHorizontal: spacing.lg },
  error: { color: colors.alert, fontFamily: fonts.body, fontSize: 11 },
});
