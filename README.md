# The Connoisseur

A polished Expo/React Native vertical slice for discovering cocktails from the ingredients already in your home bar.

## Included through Milestone 2

- Guest-first welcome and local bar setup
- Water is treated as universally available; standard ice for shaking or stirring and large ice for serving are tracked independently
- Pure, explainable recipe matching and stable ranking
- Bourbon reference scenario from the product specification
- Immediate recommendation refresh and undo after adding lemon juice
- Recipe details with availability, garnish, equipment, and serving controls
- Persisted, version-pinned Make mode with recoverable timer targets
- Timestamped saved recipes with live availability
- Six-dimension persistent taste preferences plus temporary Tonight overrides
- Weighted Quick Select with recent-pick avoidance and deliberate one-away expansion
- Deduplicated shopping list and explainable purchase-unlock simulations
- Versioned local persistence with lossless v1 migration and idempotent guest-to-account import
- Local account-flow preview for registration, sign-in, recovery, sign-out, and migration status
- Unit tests for matching, migration, preferences, Quick Select, and shopping counts

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

Guest and preview-account state are stored through a versioned AsyncStorage boundary in this slice. Passwords are never persisted and no account data leaves the device. Supabase authentication, PostgreSQL sync, and cross-device recovery require deployment configuration; the domain, merge, and UI layers are ready to move behind those adapters.
