import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { NoticeToast } from '@/components/NoticeToast';
import { BarProvider } from '@/state/BarProvider';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <BarProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.ink },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="setup" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="preferences" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="shopping" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="scan" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="catalogue" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="about" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="product/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="recipe/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="make/[sessionId]" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        </Stack>
        <NoticeToast />
      </BarProvider>
    </SafeAreaProvider>
  );
}
