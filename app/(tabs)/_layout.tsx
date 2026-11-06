import { Tabs } from 'expo-router';
import React from 'react';
import { ColorValue, StyleSheet, Text } from 'react-native';

import { colors, fonts } from '@/theme/tokens';

function TabGlyph({ glyph, color }: { glyph: string; color: ColorValue }) {
  return <Text style={[styles.glyph, { color }]}>{glyph}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.ink },
        tabBarActiveTintColor: colors.brass,
        tabBarInactiveTintColor: colors.paperDim,
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.bar,
        tabBarItemStyle: styles.item,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="tonight"
        options={{ title: 'Tonight', tabBarIcon: ({ color }) => <TabGlyph glyph="✦" color={color} /> }}
      />
      <Tabs.Screen
        name="bar"
        options={{ title: 'My Bar', tabBarIcon: ({ color }) => <TabGlyph glyph="▥" color={color} /> }}
      />
      <Tabs.Screen
        name="discover"
        options={{ title: 'Discover', tabBarIcon: ({ color }) => <TabGlyph glyph="⌕" color={color} /> }}
      />
      <Tabs.Screen
        name="saved"
        options={{ title: 'Saved', tabBarIcon: ({ color }) => <TabGlyph glyph="♡" color={color} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { height: 76, paddingTop: 7, paddingBottom: 9, backgroundColor: '#101412', borderTopWidth: 1, borderTopColor: colors.divider },
  item: { minHeight: 58 },
  label: { fontFamily: fonts.bodyMedium, fontSize: 10, marginTop: 1 },
  glyph: { fontFamily: fonts.body, fontSize: 20, lineHeight: 23 },
});
