import {
  FlavourDimension,
  FlavourProfile,
  SessionPreferences,
  TastePreferences,
} from '@/domain/types';

export const SCORING_CONFIGURATION = {
  version: 'taste-ranking-v1',
  tasteWeight: 0.65,
  coverageWeight: 0.25,
  editorialWeight: 0.1,
} as const;

export const flavourDimensions: FlavourDimension[] = [
  'sweet',
  'sour',
  'salty',
  'bitter',
  'fruity',
  'spiritForward',
];

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export function resolveTastePreferences(
  persistent: TastePreferences,
  session?: SessionPreferences,
): TastePreferences {
  return { ...persistent, ...(session?.tastes ?? {}) };
}

export function scoreTaste(profile: FlavourProfile, preferences: TastePreferences): number {
  const configured = flavourDimensions.flatMap((dimension) => {
    const preference = preferences[dimension];
    if (!preference || preference.importance <= 0) return [];
    return [{ dimension, preference }];
  });

  if (configured.length === 0) return 0.5;

  const totalImportance = configured.reduce(
    (total, item) => total + clamp01(item.preference.importance),
    0,
  );
  if (totalImportance === 0) return 0.5;

  const weightedDistance = configured.reduce((total, item) => {
    const distance = Math.abs(
      clamp01(profile[item.dimension]) - clamp01(item.preference.intensity),
    );
    return total + distance * clamp01(item.preference.importance);
  }, 0);

  return clamp01(1 - weightedDistance / totalImportance);
}

const explanationLabels: Record<FlavourDimension, string> = {
  sweet: 'sweetness',
  sour: 'sour drinks',
  salty: 'savoury flavours',
  bitter: 'bitter drinks',
  fruity: 'fruit-forward drinks',
  spiritForward: 'spirit-forward drinks',
};

export function tasteExplanation(
  profile: FlavourProfile,
  preferences: TastePreferences,
): string | undefined {
  const candidates = flavourDimensions.flatMap((dimension) => {
    const preference = preferences[dimension];
    if (!preference || preference.importance <= 0) return [];
    const closeness = 1 - Math.abs(clamp01(profile[dimension]) - clamp01(preference.intensity));
    return [{ dimension, strength: closeness * clamp01(preference.importance), closeness }];
  });
  const best = candidates.sort((left, right) => right.strength - left.strength)[0];
  if (!best || best.closeness < 0.62) return undefined;
  return `Matches your preference for ${explanationLabels[best.dimension]}.`;
}

export function recommendationScore(
  tasteMatch: number,
  ingredientCoverage: number,
  editorialPriority: number,
): number {
  return (
    SCORING_CONFIGURATION.tasteWeight * clamp01(tasteMatch) +
    SCORING_CONFIGURATION.coverageWeight * clamp01(ingredientCoverage) +
    SCORING_CONFIGURATION.editorialWeight * clamp01(editorialPriority)
  );
}
