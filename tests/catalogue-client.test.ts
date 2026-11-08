import { afterEach, describe, expect, it, vi } from 'vitest';

import { MixologyToolsCatalogue } from '@/catalogue/mixologyTools';

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const recipe = {
  id: 97,
  name: '100-Pt Julep',
  instructions: 'Muddle and serve.',
  description: '',
  image_url: null,
  source: 'Test source',
  source_url: 'https://example.test/recipe',
  avg_rating: 4.5,
  rating_count: 2,
  user_rating: null,
  created_by: null,
  abv: {
    status: 'estimated',
    min_percent: 20,
    max_percent: 25,
    display: '20–25%',
    notes: ['Estimate'],
  },
  ingredients: [
    {
      ingredient_id: 10,
      ingredient_name: 'Bourbon',
      ingredient_path: '/1/10/',
      full_name: 'Bourbon [Whiskey]',
      hierarchy: ['Whiskey', 'Bourbon'],
      amount: 2,
      unit_id: 1,
      unit_name: 'Ounce',
      unit_abbreviation: 'oz',
    },
  ],
  tags: [{ id: 1, name: 'Julep', type: 'public' }],
};

afterEach(() => {
  vi.useRealTimers();
});

describe('Mixology Tools catalogue client', () => {
  it('encodes paginated recipe searches and normalizes the provider response', async () => {
    let requestedUrl = '';
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      requestedUrl = String(input);
      return jsonResponse({
        recipes: [recipe],
        pagination: {
          page: 2,
          limit: 25,
          total_count: 2006,
          has_next: true,
          has_previous: true,
          next_cursor: 'next token',
        },
        query: 'gin & tonic',
      });
    }) as unknown as typeof fetch;
    const client = new MixologyToolsCatalogue({ fetchImpl });

    const result = await client.searchRecipes({
      query: ' gin & tonic ',
      page: 2,
      limit: 25,
      cursor: 'cursor/value',
      sortBy: 'name',
      sortOrder: 'asc',
      tags: ['Classic', 'Highball'],
      ingredients: ['Gin', 'Lime'],
    });

    const url = new URL(requestedUrl);
    expect(url.pathname).toBe('/api/v1/recipes/search');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      q: 'gin & tonic',
      page: '2',
      limit: '25',
      cursor: 'cursor/value',
      sort_by: 'name',
      sort_order: 'asc',
      tags: 'Classic,Highball',
      ingredients: 'Gin,Lime',
    });
    expect(result.pagination).toEqual({
      page: 2,
      limit: 25,
      totalCount: 2006,
      hasNext: true,
      hasPrevious: true,
      nextCursor: 'next token',
    });
    expect(result.recipes[0]).toEqual(
      expect.objectContaining({
        id: 97,
        name: '100-Pt Julep',
        imageUrl: undefined,
        averageRating: 4.5,
        ingredients: [expect.objectContaining({ ingredientName: 'Bourbon', unitAbbreviation: 'oz' })],
        abv: expect.objectContaining({ status: 'estimated', minPercent: 20 }),
      }),
    );
  });

  it('loads recipe details, ingredients, ingredient search, and catalogue counts', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/recipes/97')) return jsonResponse(recipe);
      if (url.pathname.endsWith('/ingredients/search')) {
        return jsonResponse([
          {
            id: 447,
            name: 'Four Roses Bourbon',
            description: '',
            parent_id: 10,
            path: '/1/10/447/',
            allow_substitution: true,
            percent_abv: 40,
            sugar_g_per_l: 2,
            titratable_acidity_g_per_l: null,
            url: null,
            exact_match: true,
            created_by: null,
          },
        ]);
      }
      if (url.pathname.endsWith('/ingredients')) return jsonResponse([]);
      return jsonResponse({ recipes_count: 2006, ingredients_count: 680 });
    });
    const fetchImpl = fetchMock as unknown as typeof fetch;
    const client = new MixologyToolsCatalogue({ fetchImpl });

    await expect(client.getRecipe(97)).resolves.toEqual(expect.objectContaining({ id: 97 }));
    await expect(client.listIngredients()).resolves.toEqual([]);
    await expect(client.searchIngredients(' Four Roses ')).resolves.toEqual([
      expect.objectContaining({
        id: 447,
        name: 'Four Roses Bourbon',
        parentId: 10,
        allowSubstitution: true,
        percentAbv: 40,
        exactMatch: true,
      }),
    ]);
    await expect(client.getStats()).resolves.toEqual({ recipeCount: 2006, ingredientCount: 680 });

    const ingredientSearch = new URL(String(fetchMock.mock.calls[2][0]));
    expect(ingredientSearch.searchParams.get('q')).toBe('Four Roses');
  });

  it('rejects malformed provider records instead of leaking invalid data into the app', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ ...recipe, id: '97' })) as unknown as typeof fetch;
    const client = new MixologyToolsCatalogue({ fetchImpl });

    await expect(client.getRecipe(97)).rejects.toMatchObject({
      code: 'invalid-response',
    });
  });

  it('reports provider HTTP failures with status and bounded response details', async () => {
    const fetchImpl = vi.fn(async () => new Response('temporarily unavailable', { status: 503 })) as unknown as typeof fetch;
    const client = new MixologyToolsCatalogue({ fetchImpl });

    await expect(client.getStats()).rejects.toMatchObject({
      code: 'http',
      status: 503,
      details: 'temporarily unavailable',
    });
  });

  it('distinguishes request timeouts from user cancellation', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_input: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      })) as unknown as typeof fetch;
    const client = new MixologyToolsCatalogue({ fetchImpl, timeoutMs: 20 });
    const timedRequest = client.getStats();
    const timedExpectation = expect(timedRequest).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(21);
    await timedExpectation;

    const abortController = new AbortController();
    const cancelledRequest = client.getStats({ signal: abortController.signal });
    const cancelledExpectation = expect(cancelledRequest).rejects.toMatchObject({ code: 'aborted' });
    abortController.abort();
    await cancelledExpectation;
  });

  it('validates local search parameters before making a network request', async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;
    const client = new MixologyToolsCatalogue({ fetchImpl });

    await expect(client.searchRecipes({ limit: 1001 })).rejects.toThrow(RangeError);
    await expect(client.searchIngredients('   ')).rejects.toThrow(TypeError);
    await expect(client.getRecipe(0)).rejects.toThrow(RangeError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
