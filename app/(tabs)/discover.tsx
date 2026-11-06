import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { RecipeCard } from '@/components/RecipeCard';
import { Eyebrow, Screen, ScreenScroll } from '@/components/ui';
import { useBar } from '@/state/BarProvider';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

export default function DiscoverScreen() {
  const router = useRouter();
  const { recommendations } = useBar();
  const [query, setQuery] = useState('');
  const results = useMemo(
    () => recommendations.filter((match) => `${match.recipe.name} ${match.recipe.eyebrow}`.toLowerCase().includes(query.toLowerCase())),
    [query, recommendations],
  );

  return (
    <Screen>
      <ScreenScroll>
        <View style={styles.header}>
          <Eyebrow>Reviewed recipes</Eyebrow>
          <Text accessibilityRole="header" style={styles.title}>Discover</Text>
          <Text style={styles.subtitle}>Browse the full first-edition collection. Availability stays visible as your bar changes.</Text>
        </View>
        <View style={styles.searchWrap}>
          <Text style={styles.searchGlyph}>⌕</Text>
          <TextInput
            accessibilityLabel="Search recipes"
            value={query}
            onChangeText={setQuery}
            placeholder="Search the collection"
            placeholderTextColor={colors.paperDim}
            style={styles.search}
          />
        </View>
        <Text style={styles.resultCount}>{results.length} {results.length === 1 ? 'recipe' : 'recipes'}</Text>
        <View style={styles.list}>
          {results.map((match) => (
            <RecipeCard key={match.recipe.id} match={match} onPress={() => router.push(`/recipe/${match.recipe.id}`)} />
          ))}
        </View>
      </ScreenScroll>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingTop: spacing.md },
  title: { color: colors.paper, fontFamily: fonts.display, fontSize: 38, marginTop: 3 },
  subtitle: { color: colors.paperMuted, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, maxWidth: 520, marginTop: spacing.sm },
  searchWrap: { marginTop: spacing.xxl, minHeight: 52, flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.divider, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, gap: spacing.md },
  searchGlyph: { color: colors.brass, fontFamily: fonts.body, fontSize: 20 },
  search: { flex: 1, color: colors.paper, fontFamily: fonts.body, fontSize: 14 },
  resultCount: { color: colors.paperDim, fontFamily: fonts.bodyMedium, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginTop: spacing.xl, marginBottom: spacing.md },
  list: { gap: spacing.md },
});
