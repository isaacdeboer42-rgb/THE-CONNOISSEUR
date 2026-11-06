import { Stack } from 'expo-router';
import React from 'react';

import { colors } from '@/theme/tokens';

export default function AccountLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.ink },
        animation: 'slide_from_right',
      }}
    />
  );
}
