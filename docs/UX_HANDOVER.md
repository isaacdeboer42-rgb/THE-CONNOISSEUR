# UX handover and prototype guide

## Connected prototype

The Expo app in this repository is the prototype; it uses one internally consistent local snapshot across onboarding, recommendations, inventory, saves, shopping, Make mode and account migration. Camera, external barcode lookup, hosted AI, authentication, cloud sync and shared publication are explicitly labelled simulations.

Open it with:

```bash
pnpm install
pnpm web
```

For Expo Go use `pnpm start`. Run `pnpm check:release` before a handover build.

Recommended walkthrough:

1. Explore sample and verify Whiskey Sour needs lemon, Old Fashioned needs bitters and Bourbon Smash needs lemon plus mint.
2. Compare Availability and Taste-led on Tonight; open Quick Select.
3. In My Bar, mark an item empty/restock it and inspect the recommendation change.
4. Scan the recognised vodka fixture, repeat it, Undo, then use unknown recovery and simulate extraction failure/retry.
5. Change measurement preference, select six servings, read batch guidance, start Make, exit and resume.
6. Save a recipe, inspect shopping evidence, create a local account preview and open catalogue review.
7. Use Account reset to verify the custom confirmation and that the sample/account snapshots are separate.

## Completed UX work

- Current-workspace audit separated from stale report claims.
- Stable IA, entry/back/cancel/restoration rules and journey maps.
- Screen-level implementation contracts and state/content/recovery copy.
- Connected prototype for guest-first recommendations, generic and specific inventory, simulated recognised/unknown scan, Quick Select, Make, saves, shopping, local conversion and admin review.
- Availability/Taste-led comparison, persistent ml/fl oz, 1–8 servings, batch guidance and mounted Make screen-awake behavior.
- Regression fixes for Make serving changes, web reset, sample Exit, duplicate featured recipes, sample preference values, undo invalidation and empty-bar ice visibility.
- Prioritised production backlog and usability test pack.

## Prototype limitations

No physical camera/provider/AI/auth/backend is connected. Four recipes are enough to verify logic but not production browsing or audience preference. Web QA does not replace VoiceOver, TalkBack, camera, Keep Awake or low-light device evidence. The app does not track quantities/fill level, so “on hand” means presence, not sufficient volume. Feedback remains private history and does not alter ranking.

## Unresolved decisions

- Primary audience and first-session inventory tolerance.
- Barcode supplier and Australian coverage/cost.
- Production catalogue source, recipe/image rights and editorial owner.
- Supabase region, retention, private photo storage and guest sync policy.
- Per-recipe serving/batch limits and persistent quantity model.
- Whether feedback should influence ranking and how users reset that learning.
- Commercial model, age/store policy and responsible-product review.
- Final aqua/gold mark and visual migration.

## Recommended implementation order

1. Run native accessibility/camera proof and moderated prototype sessions.
2. Decide audience, provider, catalogue rights and backend/privacy policy.
3. Implement identity, row ownership, private storage and idempotent guest import.
4. Replace scan/provider/AI simulations behind the existing typed boundaries.
5. Add production content and recipe-specific serving limits.
6. Re-run device, performance, recovery, backup and store-readiness gates.

The senior developer should not need to invent core flow behavior; remaining unknowns are explicitly product, research, content, infrastructure or compliance decisions.
