import { MakeSession } from '@/domain/types';

export function patchForRequestedServings(
  session: MakeSession,
  servings: number,
  updatedAt: string,
): Partial<MakeSession> | undefined {
  if (session.servings === servings) return undefined;
  return {
    servings,
    stepIndex: -1,
    timerTarget: undefined,
    timerStepId: undefined,
    updatedAt,
  };
}
