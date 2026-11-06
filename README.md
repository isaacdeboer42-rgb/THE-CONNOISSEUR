# The Connoisseur

A polished Expo/React Native vertical slice for discovering cocktails from the ingredients already in your home bar.

## Included through Milestone 4

- Guest-first welcome and local bar setup
- Water is treated as universally available; standard ice for shaking or stirring and large ice for serving are tracked independently and require explicit answers before matching
- Pure, explainable recipe matching and stable ranking
- Bourbon reference scenario from the product specification
- Immediate recommendation refresh and a 30-second undo window independent of transient notices
- On-hand and out-of-stock inventory controls with restocking
- Recipe details with availability, garnish, equipment, and serving controls
- Persisted, version-pinned Make mode with recoverable timer targets
- Timestamped saved recipes with live availability
- Six-dimension persistent taste preferences plus temporary Tonight overrides
- Weighted Quick Select with recent-pick avoidance and deliberate one-away expansion
- Deduplicated shopping list and explainable purchase-unlock simulations
- Versioned local persistence with lossless v1 migration, validated Make sessions, and idempotent guest-to-account import
- Clearly labelled local account-flow preview with no password fields or simulated authentication
- Unit tests for matching, migration, persistence hardening, preferences, Quick Select, and shopping counts
- GitHub Actions checks for TypeScript and tests on pushes and pull requests
- UPC-A and EAN-13 validation, checksum verification, and canonical identifiers
- Idempotent recognised-bottle additions with duplicate, restock, generic-overlap, and Undo handling
- Unknown-bottle recovery that saves private inventory before optional catalogue sharing
- Editable private bottle details with recommendation remapping that preserves submitted review evidence
- Durable private products, product-aware inventory, scan diagnostics, operation IDs, and submission-state migration
- A local asynchronous extraction preview with a demonstrable failure/retry path and strict typed output
- A local catalogue review queue with explicit approve, merge, and reject decisions
- Clearly labelled simulation boundaries for camera access, external lookup, AI, authentication, and shared publication
- Machine-enforced recipe editorial validation with review/version/publication metadata
- Private 500-character tasting notes attached only to completed Make sessions
- Withdrawn-recipe lifecycle that keeps saved references visible without recommending unavailable content
- In-app About & Privacy status with local data counts and explicit production boundaries
- EAS internal/production profiles, stable store identifiers, app-version runtime policy, and iOS privacy-manifest baseline
- Release CI that type-checks, runs 50 tests, and produces a static production web export
- Deployment, recovery, security, content, accessibility/device, performance, usability, and store-submission handover docs
- Implementation-ready UX audit, journey maps, annotated screen contracts, state/content rules, backlog and usability test pack
- Testable Availability/Taste-led recommendation views, persistent ml/fl-oz preference, 1–8 serving scaling and batch guidance

## Run locally

```bash
pnpm install
pnpm web
```

Use `pnpm start` for Expo Go, then scan the QR code from an iPhone or Android device.

## Verify

```bash
pnpm check
```

Use `pnpm check:release` for the full release gate, including the production web export. See [Release readiness](docs/RELEASE_READINESS.md) for the native/store checklist and the remaining external launch blockers.

## UX handover

Start with [UX audit](docs/UX_AUDIT.md), [information architecture](docs/UX_INFORMATION_ARCHITECTURE.md), and [prototype handover](docs/UX_HANDOVER.md). The [developer backlog](docs/UX_BACKLOG.md) and [usability test pack](docs/UX_USABILITY_TEST_PACK.md) separate proposed production work and success targets from verified implementation evidence.

Guest and preview-account state are stored through a versioned AsyncStorage boundary in this slice. The preview does not request passwords, perform authentication, open the camera, contact an external barcode provider, upload label references, run a hosted AI model, or publish catalogue records. Supabase authentication, PostgreSQL sync, secure photo storage, server-side provider/AI adapters, transactional catalogue approval, and physical-device camera testing require deployment configuration; the domain, migration, and UI layers are ready to move behind those adapters.
