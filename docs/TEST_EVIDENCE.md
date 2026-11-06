# Test evidence and acceptance matrix

## Automated evidence

`pnpm check:release` is the reproducible repository gate. It covers matching and ranking, garnish/ice/water rules, out-of-stock behavior, substitutions, family counts, Quick Select, shopping, version-pinned Make sessions, timers, persistence migrations, guest import retry/idempotency, barcode validation/canonicalisation, scan deduplication, private-product recovery, extraction failure/retry, catalogue decisions, editorial content validation, withdrawn saves, feedback-note privacy rules, release config and the production web export.

Performance evidence must record commit, dataset size, device/OS, build type, network profile, provider and test load. Acceptance targets are cached primary screen under 1 second, recommendations under 2 seconds at p95 for the agreed catalogue/load, local catalogue lookup under 2 seconds, and actionable external timeout. Measure release builds, not a development server.

## Physical-device matrix (required, not yet executed)

Record pass/fail, video or screenshot, date and tester for: current and oldest supported iPhone; compact and large Android; phone and tablet if tablet remains enabled. Test fresh install, upgrade with persisted state, offline/reconnect, background/kill/relaunch during Make mode and timer, large text, VoiceOver/TalkBack labels/order, contrast, reduced motion where applicable, and hardware/software keyboard navigation of catalogue admin.

Camera/provider scenarios: denied permission, UPC-A/EAN-13, repeated scan, generic overlap, unknown code, slow/failed provider, manual entry, private photo retry, expired/duplicate callback and interrupted submission. A failed AI job must leave the private product usable.

## Moderated usability (required, not yet executed)

With representative home-cocktail users, observe without coaching: reach a recommendation as guest; explain why it is ready; correct an out-of-stock item; use a disclosed substitution; save and later find a recipe; use Quick Select; complete and resume Make mode; add a private tasting note; scan known/unknown bottles; recover manually; and understand the opt-in share boundary.

## Release record template

| Field | Evidence |
| --- | --- |
| Commit/build | Pending native candidate |
| Automated gate | Run link and result |
| iOS devices | Pending |
| Android devices | Pending |
| Accessibility | Pending |
| Performance dataset/load | Pending |
| Camera/provider | Pending |
| Moderated sessions | Pending |
| Backup restore | Pending production service |
| Product/editorial/privacy sign-off | Pending |

The pending rows are deliberate no-go conditions. A web preview or simulator cannot close physical-camera, store-signing or production-recovery evidence.
