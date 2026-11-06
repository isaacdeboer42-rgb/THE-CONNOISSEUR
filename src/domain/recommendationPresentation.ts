import { MatchResult } from '@/domain/types';

export function withoutFeaturedRecipe(
  matches: readonly MatchResult[],
  featured?: MatchResult,
): MatchResult[] {
  return featured
    ? matches.filter((match) => match.recipe.id !== featured.recipe.id)
    : [...matches];
}
