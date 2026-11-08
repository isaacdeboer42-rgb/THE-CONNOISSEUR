# Operations, deployment and recovery

## Environments and change control

Maintain isolated development, staging and production projects with separate databases, storage buckets, provider keys and callback URLs. Production access is least-privilege and server-side roles must be enforced by the backend, never only by hidden client routes.

Schema changes use forward migrations committed with the release. Before deployment: snapshot production, rehearse on staging data, record expected duration and rollback/forward-fix, then run a smoke test covering guest recommendations, sign-in, inventory, saves, shopping, private products and admin review. Application releases must tolerate the old and new schema during rollout where possible.

## Target API boundaries

- Identity: register, sign in, recovery, refresh, delete/anonymise account.
- Bar data: user-owned inventory, basics, preferences, saves, shopping and pinned make sessions.
- Catalogue: public published versions; server-authorised editorial lifecycle and audit history.
- Broad discovery: read-only public Mixology Tools adapter with pagination, timeout, schema validation, attribution and a reviewed local fallback. No private bar state is included in these requests.
- Product resolution: provider adapter with canonical barcode, timeout, cache and manual-entry fallback.
- Private product/photo: owner-only record and private object; explicit opt-in creates a review submission.
- Extraction: queued server job with strict typed output, model/version evidence, retries and failure state.

Every mutating endpoint accepts an idempotency key. Duplicate scan, guest import and provider callbacks must return the prior result. Logs use opaque IDs and status codes, not emails, tasting notes, label text, signed URLs or tokens.

## Monitoring and incidents

Alert on authentication failures, broad-catalogue and product-provider timeout/error rates, extraction backlog, catalogue review backlog, database/storage saturation, elevated 5xx responses and backup failures. External failures must keep the reviewed local collection and private products usable and return an actionable retry/manual path.

For an incident: declare owner/severity, stop unsafe writes if needed, preserve audit evidence, rotate exposed credentials, communicate impact, restore service, verify ownership boundaries, and write a blameless post-incident record.

## Backup and restore runbook

Enable automated encrypted database backups and private-object versioning according to the approved retention policy. Backups must be access-controlled separately from production runtime credentials.

Quarterly and before risky migrations:

1. Select a known backup and restore it into a new isolated recovery environment.
2. Reconcile row counts and catalogue version/audit references.
3. Verify a sample account can see only its own inventory, saves, private products and photos.
4. Verify published catalogue reads and an admin review decision.
5. Record recovery point, recovery duration, checks, operator and any exceptions.
6. Destroy the recovery environment under the approved retention process.

No production backup or restore test exists for this local-only repository; that evidence is a hard launch blocker.
