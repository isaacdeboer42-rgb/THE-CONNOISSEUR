import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const BASE_URL = 'https://mixology.tools/api/v1';
const PAGE_SIZE = 1000;
const QUALITATIVE_MEASURES = new Set(['top', 'to top', 'rinse', 'to rinse']);

function isQualitativeMeasure(ingredient) {
  return [ingredient.unit_abbreviation, ingredient.unit_name]
    .map((value) => String(value ?? '').trim().toLowerCase())
    .some((value) => QUALITATIVE_MEASURES.has(value));
}

function audit(recipe) {
  const blockers = [];
  const warnings = [];
  if (!String(recipe.name ?? '').trim()) blockers.push('missing-name');
  if (!String(recipe.instructions ?? '').trim()) blockers.push('missing-instructions');
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) blockers.push('missing-ingredients');
  if (!String(recipe.source ?? '').trim() && !String(recipe.source_url ?? '').trim()) warnings.push('missing-source');
  const seen = new Set();
  for (const ingredient of recipe.ingredients ?? []) {
    if (!Number.isInteger(ingredient.ingredient_id) || ingredient.ingredient_id <= 0) blockers.push('invalid-ingredient-id');
    if (!String(ingredient.ingredient_name ?? '').trim()) blockers.push('missing-ingredient-name');
    if (!isQualitativeMeasure(ingredient) && !(Number.isFinite(ingredient.amount) && ingredient.amount > 0)) {
      blockers.push('missing-amount');
    }
    if (!String(ingredient.unit_abbreviation ?? ingredient.unit_name ?? '').trim()) blockers.push('missing-unit');
    if (seen.has(ingredient.ingredient_id)) warnings.push('duplicate-ingredient');
    seen.add(ingredient.ingredient_id);
  }
  return { blockers: [...new Set(blockers)], warnings: [...new Set(warnings)] };
}

async function readJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'The-Connoisseur-Catalogue-Audit/1.0' } });
  if (!response.ok) throw new Error(`Catalogue request failed (${response.status}) for ${url}`);
  return response.json();
}

async function loadRecipes() {
  const recipes = [];
  let cursor;
  do {
    const url = new URL(`${BASE_URL}/recipes/search`);
    url.searchParams.set('limit', String(PAGE_SIZE));
    url.searchParams.set('sort_by', 'name');
    url.searchParams.set('sort_order', 'asc');
    if (cursor) url.searchParams.set('cursor', cursor);
    const page = await readJson(url);
    if (!Array.isArray(page.recipes) || !page.pagination) throw new Error('Catalogue returned an unsupported page.');
    recipes.push(...page.recipes);
    cursor = page.pagination.has_next ? page.pagination.next_cursor : undefined;
    if (page.pagination.has_next && !cursor) throw new Error('Catalogue pagination stopped without a cursor.');
  } while (cursor);
  return recipes;
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

const stats = await readJson(`${BASE_URL}/stats`);
const recipes = await loadRecipes();
const idCounts = new Map();
const blockerCounts = new Map();
const warningCounts = new Map();
const needsReview = [];
let structurallyComplete = 0;
let withSourceIdentity = 0;

for (const recipe of recipes) {
  increment(idCounts, recipe.id);
  if (String(recipe.source ?? '').trim() || String(recipe.source_url ?? '').trim()) withSourceIdentity += 1;
  const result = audit(recipe);
  result.blockers.forEach((code) => increment(blockerCounts, code));
  result.warnings.forEach((code) => increment(warningCounts, code));
  if (result.blockers.length === 0) structurallyComplete += 1;
  else needsReview.push({ id: recipe.id, name: recipe.name, blockers: result.blockers });
}

const duplicateIds = [...idCounts].filter(([, count]) => count > 1);
const sortedCounts = (counts) => [...counts].sort((a, b) => b[1] - a[1]);
const reviewedAt = new Date().toISOString();
const sampleRows = needsReview.slice(0, 40).map((item) =>
  `| ${item.id} | ${String(item.name).replaceAll('|', '\\|')} | ${item.blockers.join(', ')} |`,
).join('\n');
const blockerRows = sortedCounts(blockerCounts).map(([code, count]) => `| ${code} | ${count} |`).join('\n') || '| None | 0 |';
const warningRows = sortedCounts(warningCounts).map(([code, count]) => `| ${code} | ${count} |`).join('\n') || '| None | 0 |';

const report = `# Broad catalogue audit report

Generated: ${reviewedAt}

Source: Mixology Tools public API (${BASE_URL})

## Result

- Provider-reported recipes: ${stats.recipes_count}
- Unique recipes fetched and inspected: ${recipes.length}
- Structurally complete for reference Make mode: ${structurallyComplete}
- Blocked pending data fixes: ${needsReview.length}
- Records with source identity: ${withSourceIdentity}
- Duplicate recipe IDs: ${duplicateIds.length}

This is a machine-enforced structural audit, not a claim that every recipe is factually, gastronomically, legally, or editorially accurate. Positive numeric quantities are required except for the provider's explicit qualitative \`top\` and \`rinse\` measures. Human review must still compare quantities and method with the retained original source, confirm substitutions and serving assumptions, and clear content/image rights before a recipe can enter the reviewed Connoisseur collection.

## Blocking issues

| Issue | Recipes affected |
|---|---:|
${blockerRows}

## Review warnings

| Issue | Recipes affected |
|---|---:|
${warningRows}

## First records needing fixes

| Provider ID | Recipe | Blocking issues |
|---:|---|---|
${sampleRows || '| — | None | — |'}

The complete audit is reproducible with \`pnpm audit:catalogue\`. The in-app audit applies the same blocking rules whenever a community recipe is opened.
`;

await writeFile(resolve('docs/CATALOGUE_AUDIT_REPORT.md'), report, 'utf8');
console.log(JSON.stringify({ fetched: recipes.length, structurallyComplete, blocked: needsReview.length, withSourceIdentity, duplicateIds: duplicateIds.length }));
