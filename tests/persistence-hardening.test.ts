import { describe, expect, it } from 'vitest';

import { normalizeBarSnapshot } from '@/domain/persistence';

const startedAt = '2026-01-01T00:00:00.000Z';

function session(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    recipeId: 'whiskey-sour',
    recipeVersionId: 'whiskey-sour-v1',
    servings: 2,
    stepIndex: 1,
    startedAt,
    updatedAt: '2026-01-01T00:01:00.000Z',
    ...overrides,
  };
}

describe('make-session persistence hardening', () => {
  it('preserves a valid current-version session and its active timer', () => {
    const snapshot = normalizeBarSnapshot({
      makeSessions: [
        session({
          timerTarget: '2026-01-01T00:02:00.000Z',
          timerStepId: 'ws-dry-shake',
        }),
      ],
    });

    expect(snapshot.makeSessions).toEqual([
      expect.objectContaining({
        id: 'session-1',
        recipeId: 'whiskey-sour',
        recipeVersionId: 'whiskey-sour-v1',
        servings: 2,
        stepIndex: 1,
        timerTarget: '2026-01-01T00:02:00.000Z',
        timerStepId: 'ws-dry-shake',
      }),
    ]);
  });

  it('drops sessions whose identity, recipe version, or required start date is invalid', () => {
    const snapshot = normalizeBarSnapshot({
      makeSessions: [
        session({ id: '' }),
        session({ id: 'unknown-recipe', recipeId: 'martini', recipeVersionId: 'martini-v1' }),
        session({ id: 'wrong-version', recipeVersionId: 'whiskey-sour-v999' }),
        session({ id: 'bad-date', startedAt: 'not-a-date' }),
        null,
      ],
    });

    expect(snapshot.makeSessions).toEqual([]);
  });

  it('recovers partial numeric fields and clamps progress to safe UI bounds', () => {
    const snapshot = normalizeBarSnapshot({
      makeSessions: [
        session({ id: 'low', servings: -10, stepIndex: -50, updatedAt: undefined }),
        session({ id: 'high', servings: 99, stepIndex: 99 }),
        session({ id: 'missing-numbers', servings: undefined, stepIndex: undefined }),
      ],
    });

    expect(snapshot.makeSessions).toEqual([
      expect.objectContaining({ id: 'low', servings: 1, stepIndex: -1, updatedAt: startedAt }),
      expect.objectContaining({ id: 'high', servings: 4, stepIndex: 3 }),
      expect.objectContaining({ id: 'missing-numbers', servings: 1, stepIndex: -1 }),
    ]);
  });

  it('removes invalid optional dates, feedback, and timer pairs without losing the session', () => {
    const snapshot = normalizeBarSnapshot({
      makeSessions: [
        session({
          completedAt: 'not-a-date',
          feedback: 'liked',
          timerTarget: '2026-01-01T00:02:00.000Z',
          timerStepId: 'wrong-step',
        }),
        session({
          id: 'completed',
          completedAt: '2026-01-01T00:03:00.000Z',
          feedback: 'notForMe',
          timerTarget: '2026-01-01T00:04:00.000Z',
          timerStepId: 'ws-dry-shake',
        }),
      ],
    });

    expect(snapshot.makeSessions[0]).not.toHaveProperty('completedAt');
    expect(snapshot.makeSessions[0]).not.toHaveProperty('feedback');
    expect(snapshot.makeSessions[0]).not.toHaveProperty('timerTarget');
    expect(snapshot.makeSessions[0]).not.toHaveProperty('timerStepId');
    expect(snapshot.makeSessions[1]).toEqual(
      expect.objectContaining({
        id: 'completed',
        completedAt: '2026-01-01T00:03:00.000Z',
        feedback: 'notForMe',
      }),
    );
    expect(snapshot.makeSessions[1]).not.toHaveProperty('timerTarget');
  });
});
