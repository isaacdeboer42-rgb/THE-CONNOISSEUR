import { MatchResult, QuickSelectHistoryItem } from '@/domain/types';

export interface QuickSelectOptions {
  allowSubstitutions?: boolean;
  allowOneAway?: boolean;
  random?: () => number;
}

export function quickSelectCandidates(
  matches: MatchResult[],
  history: QuickSelectHistoryItem[],
  options: QuickSelectOptions = {},
): MatchResult[] {
  const directlyReady = matches.filter(
    (match) =>
      match.category === 'ready' ||
      (options.allowSubstitutions && match.category === 'readyWithSubstitution'),
  );
  const eligible = directlyReady.length
    ? directlyReady
    : options.allowOneAway
      ? matches.filter((match) => match.category === 'oneAway')
      : [];

  const recentIds = new Set(history.slice(-5).map((item) => item.recipeId));
  const unseen = eligible.filter((match) => !recentIds.has(match.recipe.id));
  return unseen.length ? unseen : eligible;
}

export function selectQuickRecipe(
  matches: MatchResult[],
  history: QuickSelectHistoryItem[],
  options: QuickSelectOptions = {},
): MatchResult | undefined {
  const candidates = quickSelectCandidates(matches, history, options);
  if (candidates.length === 0) return undefined;

  const weights = candidates.map((match) => Math.max(0.05, match.score));
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  let cursor = Math.min(0.999999, Math.max(0, (options.random ?? Math.random)())) * totalWeight;
  for (let index = 0; index < candidates.length; index += 1) {
    cursor -= weights[index];
    if (cursor < 0) return candidates[index];
  }
  return candidates.at(-1);
}
