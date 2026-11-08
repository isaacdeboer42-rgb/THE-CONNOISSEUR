# Production catalogue database

The production catalogue is deliberately separate from the private, local bar snapshot. The migration at `supabase/migrations/202611070001_catalogue.sql` creates the PostgreSQL/Supabase model for a large searchable catalogue while the existing TypeScript fixtures remain deterministic product tests.

## What the model represents

The schema keeps concepts that look similar in the interface separate in storage:

- `catalog_ingredients` is the matchable taxonomy: gin, London dry gin, lemon juice, or a particular approved expression. Its parent and relation records support category roll-up and reviewed substitutions.
- `catalog_brands` is the consumer-facing brand identity.
- `catalog_products` is a liquid or expression and maps to one canonical ingredient/style.
- `catalog_product_packages` is a market package, including bottle volume.
- `catalog_product_barcodes` is a verified package identifier. UPC-A, EAN-8, and EAN-13 values are normalized to GTIN-14 for lookup; the original code and symbology are preserved.
- `catalog_recipes` is the stable identity users save.
- `catalog_recipe_versions` is an editorially immutable version used by Make sessions. Requirements, ordered ingredient options, steps, equipment, tags, and flavour values belong to a version.

Published recipe rows and their children are publicly readable through row-level security. Drafts, review work, import batches, source identity maps, and audit events have no public policy and are intended for a trusted server/service role only. There are no public write policies.

The migration enforces the important lifecycle rules in the database:

- a version cannot publish without requirements, at least one ingredient option per requirement, a step, and a six-axis flavour profile;
- published and withdrawn recipe content cannot be edited in place;
- a published version can only be withdrawn, and a withdrawn version cannot be republished;
- material changes are made as a new version, preserving saved recipes and in-progress Make sessions;
- only rights-verified, published media can be read publicly.

## Initial broad source

As checked on 7 November 2026, [Mixology Tools](https://mixology.tools/) reports 2,006 recipes and 680 hierarchical ingredients. Its [project repository](https://github.com/kthorn/cocktaildb) is MIT-licensed, and its About page describes the project as open source/open data with a public read API and downloadable PostgreSQL backup.

That makes it useful as a broad discovery upstream, not an automatic publication authority. Many records retain source links to third-party recipe publishers. The aggregator's open-data statement does not by itself prove that every instruction, description, or image is cleared for this commercial product. An import must therefore:

1. create a `catalog_sources` row with the exact upstream URL, stated licence/terms, retrieval date, and attribution;
2. retain every upstream external ID and source URL in `catalog_external_ids`;
3. import into `draft`, never directly into `published`;
4. keep the raw-file SHA-256 and row counts in `catalog_import_batches`;
5. normalize units and ingredient identities without silently inventing quantities;
6. deduplicate recipes by source identity first, then queue possible name/content matches for human review;
7. run the existing editorial validation plus rights review before publication;
8. omit upstream images unless the licence and attribution for that individual image are documented in `catalog_media`.

The public API is appropriate for paginated browsing while an ingestion job and editorial review are being built. A production snapshot should be imported server-side so ranking, availability queries, withdrawal, and source reconciliation remain under application control.

## Branded bottles and barcodes

Cocktail recipes and retail bottles are different datasets. Do not infer a UPC/EAN, bottle size, brand, or product from a recipe ingredient name.

[Open Food Facts](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/) can be evaluated as a separate product/barcode source. Its database is ODbL 1.0; its product images have separate Creative Commons Attribution-ShareAlike terms. If selected, keep its imported rows and derived database clearly attributable, record its source IDs, comply with share-alike requirements, and review whether mixing that data into the primary catalogue changes distribution obligations. Do not copy images until their individual attribution and reuse path is approved.

Provider data is evidence, not truth. A barcode is published only after checksum normalization and a provider/editor verification state. Conflicts are marked `disputed`; they are never silently overwritten. Brand ownership, producer, product expression, market package, and barcode should remain independently correctable.

## Import and publication sequence

Use a trusted server process, never an Expo client or a public Supabase key:

1. Fetch a versioned export or paginated API responses and calculate SHA-256 before transformation.
2. Insert `catalog_import_batches(status = 'running')` and land raw data in a private staging schema or object store.
3. Upsert source identities in `catalog_external_ids`; make the job idempotent on source plus external ID.
4. Normalize slugs, names, measurement units, locales, GTIN-14 values, and ingredient hierarchy into draft catalogue rows.
5. Reject malformed references and ambiguous mappings into a review queue; count every rejection on the batch.
6. Run relational checks and the TypeScript editorial gate. Record reviewer identity and timestamps.
7. Transition complete versions from `draft` to `reviewed`, then to `published` in one server-side transaction.
8. Mark the import batch `published` with final inserted, updated, and rejected counts. Reconcile those counts against the upstream snapshot.

The database publication trigger intentionally requires child rows before the version is updated to `published`; direct insertion as published is not the supported path.

## Search and scale

GIN full-text and trigram indexes cover brand, ingredient, product, and recipe names. Foreign-key and reverse join indexes cover ingredient-to-recipe candidate selection, product mapping, tags, and version history. `catalog_published_recipe_search` is a security-invoker view over published content.

At runtime:

- page discovery queries; do not load thousands of complete recipes into a React `ScrollView`;
- search/select candidate recipes in PostgreSQL, then apply the existing explainable scoring to that bounded set;
- cache a versioned compact published index in SQLite for offline mobile use rather than putting the catalogue in AsyncStorage;
- fetch recipe details, steps, media, and product packages lazily;
- preserve unresolved IDs and tombstones during offline periods instead of deleting user inventory or saved references.

## Applying the migration

With a configured Supabase project, apply migrations through the normal Supabase CLI workflow (for example, a local `supabase db reset` followed by the project's deployment process). The migration enables `pgcrypto` and `pg_trgm`; confirm they are allowed in the selected hosted region.

After applying it, verify as separate roles:

- anonymous users can select only published recipes/products and approved supporting rows;
- anonymous and authenticated clients cannot insert, update, or delete catalogue rows;
- import batches, external IDs, drafts, and audit events are invisible without the trusted service role;
- attempting to edit a published version or any of its children fails;
- withdrawing a version removes it from the public search view without deleting its stable recipe identity or history.
