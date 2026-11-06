# Release readiness

Status: repository-complete release candidate; not yet eligible for public-store submission.

## Automated gate

Run `pnpm check:release`. It type-checks the app, runs the domain, migration, content and release tests, then creates a production static web export in `dist/`. GitHub Actions runs the same command on every push and pull request.

The native application uses `com.connoisseur.app`, user version `1.0.0`, and remote EAS build-version management. `eas.json` provides internal and production profiles. Never place signing credentials, service-account JSON or App Store Connect keys in the repository.

## Required launch sequence

1. Replace the placeholder/default icon and splash treatment with approved 1024px artwork and capture final phone/tablet screenshots.
2. Create the Expo project and set its project ID; configure Apple Developer, App Store Connect and Google Play Console access outside Git.
3. Select and contract the authentication/database, object storage, barcode and AI providers described in `OPERATIONS.md`.
4. Execute migrations in development, staging and production; verify row ownership and private object access before importing real data.
5. Run the physical-device matrix and moderated usability sessions in `TEST_EVIDENCE.md`.
6. Complete Apple/Google privacy and data-safety declarations from the deployed data flows, publish a public privacy-policy URL, and verify the generated iOS privacy manifest.
7. Build internal candidates with `eas build --profile preview --platform all`; retain build URLs and results in the release record.
8. After sign-off, use `eas build --profile production --platform all` and `eas submit --profile production --platform all`. Submission uploads binaries; store listing metadata and review answers still need completion in the store consoles.

## Go/no-go owners

Product signs off content rights, commercial model and guest-preview scope. Engineering signs off migrations, recovery, security, performance and builds. Editorial signs off every published recipe version. Operations signs off monitoring, provider budgets, backups and restore evidence. Privacy/legal signs off public policy text, retention and store declarations.

## Open decisions

- Barcode supplier, regional coverage, timeout and monthly budget.
- Authentication/database, private photo storage and hosting regions.
- AI provider, model, strict-output strategy, rate limit and cost ceiling.
- Supported iOS/Android versions and representative device list.
- Photo, audit-log, account and backup retention periods.
- Ingredient taxonomy ownership and substitution approval policy.
- Recipe/source image rights and commercial model.

These are launch blockers because they change the deployed privacy, cost or product contract. The local release candidate deliberately does not guess them.

## Known limitations

The current build is local-only: no real authentication, cross-device sync, camera capture, external barcode lookup, hosted AI, server-admin roles, cloud photo upload, monitoring or automated backup. The catalogue review queue is a labelled local simulation. Local data is not a backup.
