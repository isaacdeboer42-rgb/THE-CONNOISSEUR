import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Eyebrow, IconButton, Screen, ScreenScroll } from '@/components/ui';
import { useBar } from '@/state/BarProvider';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

export default function RecoveryScreen() {
  const router = useRouter();
  const { recoverAccount } = useBar();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [complete, setComplete] = useState(false);

  const submit = async () => {
    setComplete(false);
    setError(undefined);
    const result = await recoverAccount(email);
    if (!result.ok) setError(result.error);
    else {
      setComplete(true);
    }
  };

  return (
    <Screen>
      <ScreenScroll contentStyle={styles.scroll}>
        <View style={styles.topBar}><IconButton label="Go back" glyph="‹" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/bar')} /><Text style={styles.topLabel}>ACCOUNT RECOVERY</Text><View style={styles.spacer} /></View>
        <Eyebrow>Preview recovery</Eyebrow>
        <Text accessibilityRole="header" style={styles.title}>Check this device.</Text>
        <Text style={styles.body}>Enter an email to check whether a matching local preview account exists. A production build will use a time-limited Supabase recovery link.</Text>
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              accessibilityLabel="Email"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setComplete(false);
                setError(undefined);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={colors.paperDim}
              style={styles.input}
            />
          </View>
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {complete ? (
            <View style={styles.success} accessibilityLiveRegion="polite">
              <Text style={styles.successTitle}>Local preview account found</Text>
              <Text style={styles.successBody}>No recovery email was sent and no data was transmitted. Return to the preview sign-in screen to open it.</Text>
            </View>
          ) : null}
          <Button label="Check this device" onPress={() => void submit()} />
          <Button label="Back to preview sign-in" variant="ghost" onPress={() => router.replace('/account/sign-in')} />
        </View>
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.huge },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: spacing.sm, marginBottom: spacing.xxxl },
  topLabel: { color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1.4 },
  spacer: { width: 44 },
  title: { color: colors.paper, fontFamily: fonts.display, fontSize: 43, lineHeight: 49, marginTop: spacing.sm },
  body: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 22, marginTop: spacing.md },
  form: { gap: spacing.lg, marginTop: spacing.xxl },
  field: { gap: spacing.sm },
  label: { color: colors.paperMuted, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  input: { minHeight: 54, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, color: colors.paper, fontFamily: fonts.body, fontSize: 14, paddingHorizontal: spacing.lg },
  error: { color: colors.alert, fontFamily: fonts.body, fontSize: 11 },
  success: { borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(169,214,141,0.22)', backgroundColor: colors.readyDeep, padding: spacing.lg },
  successTitle: { color: colors.ready, fontFamily: fonts.bodyMedium, fontSize: 12 },
  successBody: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 11, lineHeight: 17, marginTop: 4 },
});
