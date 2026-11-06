import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useBar } from '@/state/BarProvider';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

export function NoticeToast() {
  const { notice, undo, clearNotice } = useBar();

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(clearNotice, 5000);
    return () => clearTimeout(timer);
  }, [clearNotice, notice]);

  if (!notice) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={styles.position}
      pointerEvents="box-none"
    >
      <View style={styles.toast}>
        <View style={styles.check}>
          <Text style={styles.checkText}>✓</Text>
        </View>
        <Text style={styles.message} numberOfLines={2}>
          {notice.message}
        </Text>
        {notice.canUndo ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Undo last change" onPress={undo} hitSlop={8}>
            <Text style={styles.undo}>Undo</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  position: { position: 'absolute', left: spacing.xl, right: spacing.xl, bottom: 94, zIndex: 20, alignItems: 'center' },
  toast: {
    width: '100%',
    maxWidth: 520,
    minHeight: 56,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(169,214,141,0.24)',
    backgroundColor: '#172019',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  check: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.readyDeep, alignItems: 'center', justifyContent: 'center' },
  checkText: { color: colors.ready, fontFamily: fonts.bodyMedium, fontSize: 14 },
  message: { flex: 1, color: colors.paper, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  undo: { color: colors.brass, fontFamily: fonts.bodyMedium, fontSize: 13, textDecorationLine: 'underline' },
});
