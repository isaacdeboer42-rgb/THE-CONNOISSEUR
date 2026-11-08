# Broad catalogue audit report

Generated: 2026-11-08T21:48:19.713Z

Source: Mixology Tools public API (https://mixology.tools/api/v1)

## Result

- Provider-reported recipes: 2006
- Unique recipes fetched and inspected: 2006
- Structurally complete for reference Make mode: 1904
- Blocked pending data fixes: 102
- Records with source identity: 1976
- Duplicate recipe IDs: 0

This is a machine-enforced structural audit, not a claim that every recipe is factually, gastronomically, legally, or editorially accurate. Positive numeric quantities are required except for the provider's explicit qualitative `top` and `rinse` measures. Human review must still compare quantities and method with the retained original source, confirm substitutions and serving assumptions, and clear content/image rights before a recipe can enter the reviewed Connoisseur collection.

## Blocking issues

| Issue | Recipes affected |
|---|---:|
| missing-unit | 101 |
| missing-amount | 12 |
| missing-instructions | 1 |

## Review warnings

| Issue | Recipes affected |
|---|---:|
| missing-source | 30 |

## First records needing fixes

| Provider ID | Recipe | Blocking issues |
|---:|---|---|
| 97 | 100-Pt Julep | missing-unit |
| 117 | Amen Corner | missing-unit |
| 119 | American Tiki | missing-unit |
| 146 | Banana Spider | missing-unit |
| 159 | Beuser & Angus Special | missing-unit |
| 188 | Brandy Smash | missing-unit |
| 199 | Caipirinha | missing-unit |
| 796 | Canton Shandy | missing-instructions |
| 229 | Chrysanthemum #2 | missing-amount, missing-unit |
| 306 | Cynar Julep | missing-unit |
| 307 | Dan Sabo's Mojito | missing-unit |
| 308 | Dear Prudence | missing-unit |
| 273 | Destroyer Cocktail | missing-unit |
| 282 | Don's Mai Tai | missing-unit |
| 313 | Dusty Trails | missing-unit |
| 314 | Dutch Courage's Southside | missing-unit |
| 316 | Easy Street | missing-unit |
| 321 | El Diablo Pepino | missing-unit |
| 348 | False Start | missing-unit |
| 365 | Florodora | missing-amount, missing-unit |
| 379 | French Pearl | missing-unit |
| 385 | Gage & Tollner's Stinger | missing-unit |
| 386 | Gage & Tollner's Turf | missing-amount, missing-unit |
| 413 | Ginger Smash | missing-unit |
| 416 | Girl From Cadiz | missing-unit |
| 420 | Go-To | missing-unit |
| 431 | Grand Army’s Amaretto Sour | missing-unit |
| 433 | Grapefruit Basil Martini | missing-unit |
| 435 | Green Park Cocktail | missing-unit |
| 440 | Grievous Angel | missing-amount, missing-unit |
| 445 | Half Court Cobbler | missing-unit |
| 454 | Harrison Ginsberg’s Sherry Cobbler | missing-unit |
| 457 | Harvest Smash | missing-unit, missing-amount |
| 458 | Harvest Sour | missing-amount, missing-unit |
| 462 | Heart-Shaped Box | missing-unit, missing-amount |
| 468 | Hi Falutin’ | missing-unit |
| 471 | High Line Fizz | missing-unit |
| 474 | Hole in the Fence | missing-unit |
| 481 | Horsefeather | missing-unit |
| 490 | Improved Whiskey Cocktail | missing-unit |

The complete audit is reproducible with `pnpm audit:catalogue`. The in-app audit applies the same blocking rules whenever a community recipe is opened.
