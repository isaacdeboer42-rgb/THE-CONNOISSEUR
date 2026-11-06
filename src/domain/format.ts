import { MeasurementSystem, MeasurementUnit, RecipeRequirement } from '@/domain/types';

const discreteUnits = new Set<MeasurementUnit>(['dash', 'piece', 'leaf', 'egg', 'scoop']);

function tidyNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

export function scaledAmount(requirement: RecipeRequirement, servings: number, baseServings: number): number {
  if (!requirement.scalable) return requirement.amount;
  return requirement.amount * (servings / baseServings);
}

export function formatRequirementAmount(
  requirement: RecipeRequirement,
  servings: number,
  baseServings: number,
  measurementSystem: MeasurementSystem = 'metric',
): string {
  const amount = scaledAmount(requirement, servings, baseServings);
  const value = tidyNumber(amount);

  if (requirement.unit === 'ml') {
    return measurementSystem === 'us'
      ? `${tidyNumber(amount / 29.5735)} fl oz`
      : `${value} ml`;
  }
  if (requirement.unit === 'egg') return `${value} egg white${amount === 1 ? '' : 's'}`;
  if (requirement.unit === 'leaf') return `${value} ${amount === 1 ? 'leaf' : 'leaves'}`;
  if (requirement.unit === 'dash') return `${value} dash${amount === 1 ? '' : 'es'}`;
  if (requirement.unit === 'piece') return `${value} piece${amount === 1 ? '' : 's'}`;
  if (requirement.unit === 'scoop') return `${value} scoop${amount === 1 ? '' : 's'}`;
  return discreteUnits.has(requirement.unit) ? value : `${value} ${requirement.unit}`;
}
