# UX audit

Date: 6 November 2026. Scope: current repository at Milestone 4, supplied assignment, QA report, UX direction and competitor desk review. The linked pages are proposals and desk research, not participant evidence.

## Evidence labels

- **Verified**: reproduced in current source, automated tests or the running Expo web prototype.
- **Reported**: present in a supplied research page but not accepted without current verification.
- **Recommendation**: design judgement to test.
- **Assumption**: requires interviews, usability or production/provider evidence.

## Task-critical audit

| Concern | Current finding | Status and resolution |
| --- | --- | --- |
| Starter leaves ice unknown | Setup requires an explicit answer for standard and large ice; “See my matches” is disabled until both are answered. | Reported defect is obsolete. Preserve explicit choice; do not silently assume ice. |
| Sample includes lemon | `SAMPLE_INGREDIENT_IDS` is bourbon, sugar syrup and egg white. Both ice types are available; lemon and bitters are absent. | Obsolete; regression tested. |
| Reference recommendations | With confirmed ice: Whiskey Sour needs lemon; Old Fashioned needs bitters; Bourbon Smash needs lemon and mint. Garnish is optional. | Verified by matching tests. |
| Undo tied to toast | Undo has an independent 30-second expiry. A stale notice could survive a later non-undoable action. | Valid edge case fixed: invalidation and expiry now clear undo-specific copy. A later production design should retain a dismissible confirmation card until the inventory can no longer be reversed. |
| Stock controls absent | My Bar exposes Mark empty and Restock; out-of-stock inventory does not satisfy recipes. | Obsolete. Ice cards now remain visible even when the bottle shelf is empty. |
| Scanning absent | Live UPC-A/EAN-13 camera detection now feeds the existing recognised, duplicate, overlap, unknown, manual, optional-share, extraction failure/retry and review states. | Camera implementation verified by source/export; physical-device and provider-coverage evidence remain open. |
| Only three recipes | Four reviewed variants exist, including vodka scan refresh. This exercises families, one-away, optional garnish and repeated-family counts. | Enough for a vertical-slice prototype; insufficient for production browsing research. |
| Quick-add label wrong | Label is generated from the actual missing ingredient. Staples route to their ice state, not generic inventory. | Obsolete. |
| Tiny essential labels | Remaining 10-unit private-note and withdrawn labels were below the design floor. | Fixed to 11. Physical large-text validation remains open. |
| Taste sorting unavailable | Recommendations were availability-grouped only, although taste contributed within groups. | Fixed with explicit Availability and Taste-led controls. Taste-led order retains readiness/missing labels. |
| Feedback implies learning | Completion copy says private feedback is stored with the session; it does not claim ranking changes. | Verified. Learning remains deferred. |
| Quick Select terminology | Tonight, accessibility labels and result flow use Quick Select. | Verified. |
| Resumed Make ignores changed servings | An unfinished session was returned even when the user requested another serving count. | Valid and fixed: changing servings resets that session to preflight, clears its timer and keeps the new count. |
| Guest reset fails on web | `Alert.alert` did not provide a reliable web confirmation callback. | Valid and fixed with an accessible in-app confirmation modal. |
| Featured recipe repeats | When all matches were “More to explore”, the first recipe also appeared in that section. | Valid and fixed; the featured ID is excluded from later presentation. |
| Sample Exit stays in sample mode | Exit navigated home without changing mode. | Valid and fixed; it activates the guest snapshot before navigation. |
| Sample preferences do not map to controls | Sample taste numbers sat between the three UI values. | Valid and fixed; sample values now map exactly to visible segments. |
| Measurement preference absent | AU market requires ml default with optional US fl oz. | Fixed in prototype; preference persists in the local snapshot and recipe/Make amounts follow it. |
| More than four servings unavailable | Host flow required testing one to eight. | Fixed: recipe detail accepts 1–8 and gives two-batch guidance above four. |
| Screen awake in Make | Missing. | Implemented with Expo Keep Awake for the mounted Make flow; device verification required. |
| Expo configuration warning | `newArchEnabled` was rejected by the Expo 58 schema in the supplied run. | Removed. Expo Doctor no longer reports that config issue; this host cannot complete npm-dependent Doctor checks because `npm` is unavailable. |

## Research and competitor implications

- Category inventory plus can-make/one-away grouping is table stakes across Cocktail Party, Mixel, My Bar and Cocktail Flow.
- Brand-aware barcode inventory is rarer; noflair is the closest cited overlap. The opportunity is graceful unknown recovery, not scanning alone.
- Unlock-count shopping is familiar but can feel commercial. Lead with ingredient category and show the recipe-family evidence.
- Zero-setup substitutes—shelf glance, search, notes—set the real speed benchmark. The first useful recommendation should be testable within two minutes, not treated as a measured result.
- Audience priority remains open. Occasional makers, enthusiasts and hosts should be recruited separately before choosing one as primary.

## Decisions and assumptions

| Decision | Rationale | Evidence status |
| --- | --- | --- |
| Availability is the default sort; taste-led is explicit | Preserves readiness trust while making the research comparison testable. | Recommendation to validate. |
| Both ice types require explicit confirmation | They affect different variants; guessing would misstate readiness. | Product rule and verified matching behavior. |
| ml is default; fl oz is optional | Australian first-market assumption. | Assignment requirement. |
| Serving changes reset an unfinished Make session to preflight | Prevents silent quantity changes midway through a step. | Reversible prototype decision. |
| More than four servings shows batch guidance | Typical home shakers cannot reliably hold an eight-serve batch. | Assumption; editorial limits should become recipe metadata. |
| Camera scanning is live; provider/AI/auth remain visibly simulated | Enables physical scanning without implying production lookup, extraction, or identity services. | Verified implementation boundary; device evidence pending. |
| Current brass-led visual system remains | Branding is secondary in this assignment; an aqua migration is not required for task validation. | Reversible design decision. |

No interviews, participant quotes, measured completion rates or native-device results are claimed.
