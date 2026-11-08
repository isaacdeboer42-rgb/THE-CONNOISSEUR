begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create or replace function public.catalog_touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.catalog_sources (
  id uuid primary key default extensions.gen_random_uuid(),
  source_key text not null unique check (source_key = lower(source_key) and source_key ~ '^[a-z0-9][a-z0-9_-]*$'),
  name text not null check (btrim(name) <> ''),
  provider text not null check (btrim(provider) <> ''),
  source_url text not null check (source_url ~ '^https?://'),
  license_name text,
  license_url text check (license_url is null or license_url ~ '^https?://'),
  terms_url text check (terms_url is null or terms_url ~ '^https?://'),
  attribution text,
  status text not null default 'active' check (status in ('active', 'paused', 'retired')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_import_batches (
  id uuid primary key default extensions.gen_random_uuid(),
  source_id uuid not null references public.catalog_sources(id) on delete restrict,
  source_version text,
  checksum_sha256 text not null check (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'running' check (status in ('running', 'validated', 'published', 'failed', 'rolled_back')),
  records_seen integer not null default 0 check (records_seen >= 0),
  records_inserted integer not null default 0 check (records_inserted >= 0),
  records_updated integer not null default 0 check (records_updated >= 0),
  records_rejected integer not null default 0 check (records_rejected >= 0),
  error_summary text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (source_id, checksum_sha256),
  check (finished_at is null or finished_at >= started_at),
  check (status = 'running' or finished_at is not null)
);

create table if not exists public.catalog_brands (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9-]*$'),
  name text not null check (btrim(name) <> ''),
  legal_name text,
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  description text,
  status text not null default 'active' check (status in ('active', 'merged', 'retired')),
  merged_into_id uuid references public.catalog_brands(id) on delete restrict,
  source_id uuid references public.catalog_sources(id) on delete restrict,
  search_document tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(legal_name, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'merged') = (merged_into_id is not null)),
  check (merged_into_id is null or merged_into_id <> id)
);

create table if not exists public.catalog_ingredients (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9-]*$'),
  canonical_name text not null check (btrim(canonical_name) <> ''),
  short_name text not null check (btrim(short_name) <> ''),
  parent_id uuid references public.catalog_ingredients(id) on delete restrict,
  brand_id uuid references public.catalog_brands(id) on delete set null,
  kind text not null check (kind in ('spirit', 'liqueur', 'wine', 'beer', 'mixer', 'juice', 'syrup', 'bitters', 'garnish', 'produce', 'dairy', 'pantry', 'ice', 'water', 'other')),
  description text,
  percent_abv numeric(6,3) check (percent_abv is null or percent_abv between 0 and 100),
  sugar_g_per_l numeric(10,3) check (sugar_g_per_l is null or sugar_g_per_l >= 0),
  acidity_g_per_l numeric(10,3) check (acidity_g_per_l is null or acidity_g_per_l >= 0),
  allow_substitution boolean not null default false,
  is_staple boolean not null default false,
  is_implicit boolean not null default false,
  status text not null default 'active' check (status in ('active', 'merged', 'retired')),
  merged_into_id uuid references public.catalog_ingredients(id) on delete restrict,
  source_id uuid references public.catalog_sources(id) on delete restrict,
  search_document tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(canonical_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(short_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (parent_id is null or parent_id <> id),
  check ((status = 'merged') = (merged_into_id is not null)),
  check (merged_into_id is null or merged_into_id <> id),
  check (not is_implicit or is_staple)
);

create table if not exists public.catalog_ingredient_aliases (
  id uuid primary key default extensions.gen_random_uuid(),
  ingredient_id uuid not null references public.catalog_ingredients(id) on delete cascade,
  locale text not null default 'en' check (locale ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  display_alias text not null check (btrim(display_alias) <> ''),
  normalized_alias text not null check (normalized_alias = lower(btrim(normalized_alias)) and btrim(normalized_alias) <> ''),
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  source_id uuid references public.catalog_sources(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (ingredient_id, locale, normalized_alias)
);

create table if not exists public.catalog_ingredient_relations (
  parent_ingredient_id uuid not null references public.catalog_ingredients(id) on delete cascade,
  child_ingredient_id uuid not null references public.catalog_ingredients(id) on delete cascade,
  relation_type text not null check (relation_type in ('is_a', 'substitutes_for', 'equivalent_to')),
  priority smallint not null default 0 check (priority >= 0),
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  source_id uuid references public.catalog_sources(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (parent_ingredient_id, child_ingredient_id, relation_type),
  check (parent_ingredient_id <> child_ingredient_id)
);

create table if not exists public.catalog_products (
  id uuid primary key default extensions.gen_random_uuid(),
  brand_id uuid not null references public.catalog_brands(id) on delete restrict,
  ingredient_id uuid not null references public.catalog_ingredients(id) on delete restrict,
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9-]*$'),
  name text not null check (btrim(name) <> ''),
  expression text,
  description text,
  percent_abv numeric(6,3) check (percent_abv is null or percent_abv between 0 and 100),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'published', 'withdrawn')),
  source_id uuid not null references public.catalog_sources(id) on delete restrict,
  search_document tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(expression, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_product_packages (
  id uuid primary key default extensions.gen_random_uuid(),
  product_id uuid not null references public.catalog_products(id) on delete cascade,
  volume_ml integer check (volume_ml is null or volume_ml > 0),
  package_label text,
  package_type text,
  market_code text check (market_code is null or market_code ~ '^[A-Z]{2}$'),
  status text not null default 'active' check (status in ('active', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (volume_ml is not null or nullif(btrim(package_label), '') is not null)
);

create table if not exists public.catalog_product_barcodes (
  id uuid primary key default extensions.gen_random_uuid(),
  package_id uuid not null references public.catalog_product_packages(id) on delete cascade,
  canonical_gtin14 text not null unique check (canonical_gtin14 ~ '^[0-9]{14}$'),
  original_code text not null check (original_code ~ '^[0-9]{8,14}$'),
  symbology text not null check (symbology in ('ean8', 'upca', 'ean13', 'gtin14')),
  market_code text check (market_code is null or market_code ~ '^[A-Z]{2}$'),
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'provider_verified', 'editor_verified', 'disputed', 'retired')),
  verified_at timestamptz,
  source_id uuid not null references public.catalog_sources(id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((verification_status in ('provider_verified', 'editor_verified')) = (verified_at is not null))
);

create table if not exists public.catalog_recipe_families (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9-]*$'),
  name text not null check (btrim(name) <> ''),
  description text,
  status text not null default 'active' check (status in ('active', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_recipes (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9-]*$'),
  canonical_name text not null check (btrim(canonical_name) <> ''),
  family_id uuid references public.catalog_recipe_families(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'merged', 'withdrawn')),
  merged_into_id uuid references public.catalog_recipes(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'merged') = (merged_into_id is not null)),
  check (merged_into_id is null or merged_into_id <> id)
);

create table if not exists public.catalog_recipe_versions (
  id uuid primary key default extensions.gen_random_uuid(),
  recipe_id uuid not null references public.catalog_recipes(id) on delete restrict,
  version integer not null check (version > 0),
  name text not null check (btrim(name) <> ''),
  eyebrow text not null default '',
  description text not null default '',
  variant_description text not null default '',
  base_servings numeric(8,3) not null check (base_servings > 0),
  preparation_minutes integer not null check (preparation_minutes > 0),
  difficulty text check (difficulty in ('Easy', 'Considered', 'Advanced')),
  editorial_priority numeric(8,5) not null default 0 check (editorial_priority >= 0),
  accent text check (accent is null or accent ~ '^#[0-9A-Fa-f]{6}$'),
  publication_status text not null default 'draft' check (publication_status in ('draft', 'reviewed', 'published', 'withdrawn')),
  source_id uuid not null references public.catalog_sources(id) on delete restrict,
  source_reference text,
  reviewed_at timestamptz,
  reviewed_by text,
  published_at timestamptz,
  withdrawn_at timestamptz,
  search_document tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(eyebrow, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(variant_description, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recipe_id, version),
  check (
    publication_status not in ('published', 'withdrawn') or
    (reviewed_at is not null and nullif(btrim(reviewed_by), '') is not null and published_at is not null)
  ),
  check ((publication_status = 'withdrawn') = (withdrawn_at is not null)),
  check (withdrawn_at is null or withdrawn_at >= published_at)
);

create table if not exists public.catalog_recipe_requirements (
  id uuid primary key default extensions.gen_random_uuid(),
  recipe_version_id uuid not null references public.catalog_recipe_versions(id) on delete cascade,
  position smallint not null check (position >= 0),
  amount numeric(12,4) check (amount is null or amount > 0),
  unit_code text,
  measure_text text,
  required boolean not null default true,
  garnish boolean not null default false,
  scalable boolean not null default true,
  preparation text,
  created_at timestamptz not null default now(),
  unique (recipe_version_id, position),
  check (amount is not null or nullif(btrim(measure_text), '') is not null),
  check (not garnish or not required)
);

create table if not exists public.catalog_recipe_requirement_options (
  requirement_id uuid not null references public.catalog_recipe_requirements(id) on delete cascade,
  ingredient_id uuid not null references public.catalog_ingredients(id) on delete restrict,
  priority smallint not null default 0 check (priority >= 0),
  created_at timestamptz not null default now(),
  primary key (requirement_id, ingredient_id),
  unique (requirement_id, priority)
);

create table if not exists public.catalog_recipe_steps (
  id uuid primary key default extensions.gen_random_uuid(),
  recipe_version_id uuid not null references public.catalog_recipe_versions(id) on delete cascade,
  position smallint not null check (position >= 0),
  title text not null check (btrim(title) <> ''),
  instruction text not null check (btrim(instruction) <> ''),
  timer_seconds integer check (timer_seconds is null or timer_seconds > 0),
  tip text,
  created_at timestamptz not null default now(),
  unique (recipe_version_id, position)
);

create table if not exists public.catalog_equipment (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9-]*$'),
  name text not null unique check (btrim(name) <> ''),
  description text,
  status text not null default 'active' check (status in ('active', 'retired')),
  created_at timestamptz not null default now()
);

create table if not exists public.catalog_recipe_equipment (
  recipe_version_id uuid not null references public.catalog_recipe_versions(id) on delete cascade,
  equipment_id uuid not null references public.catalog_equipment(id) on delete restrict,
  position smallint not null default 0 check (position >= 0),
  optional boolean not null default false,
  primary key (recipe_version_id, equipment_id),
  unique (recipe_version_id, position)
);

create table if not exists public.catalog_tags (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9][a-z0-9-]*$'),
  name text not null unique check (btrim(name) <> ''),
  tag_type text not null check (tag_type in ('taste', 'family', 'season', 'occasion', 'technique', 'dietary', 'other')),
  status text not null default 'active' check (status in ('active', 'retired')),
  created_at timestamptz not null default now()
);

create table if not exists public.catalog_recipe_tags (
  recipe_version_id uuid not null references public.catalog_recipe_versions(id) on delete cascade,
  tag_id uuid not null references public.catalog_tags(id) on delete restrict,
  primary key (recipe_version_id, tag_id)
);

create table if not exists public.catalog_recipe_flavour_profiles (
  recipe_version_id uuid primary key references public.catalog_recipe_versions(id) on delete cascade,
  sweet numeric(5,4) not null check (sweet between 0 and 1),
  sour numeric(5,4) not null check (sour between 0 and 1),
  salty numeric(5,4) not null check (salty between 0 and 1),
  bitter numeric(5,4) not null check (bitter between 0 and 1),
  fruity numeric(5,4) not null check (fruity between 0 and 1),
  spirit_forward numeric(5,4) not null check (spirit_forward between 0 and 1),
  created_at timestamptz not null default now()
);

create table if not exists public.catalog_media (
  id uuid primary key default extensions.gen_random_uuid(),
  entity_type text not null check (entity_type in ('brand', 'ingredient', 'product', 'recipe_version')),
  entity_id uuid not null,
  media_type text not null check (media_type in ('image', 'video')),
  storage_path text not null check (btrim(storage_path) <> ''),
  alt_text text not null check (btrim(alt_text) <> ''),
  license_name text not null check (btrim(license_name) <> ''),
  license_url text check (license_url is null or license_url ~ '^https?://'),
  attribution text not null check (btrim(attribution) <> ''),
  source_url text not null check (source_url ~ '^https?://'),
  rights_verified_at timestamptz not null,
  publication_status text not null default 'draft' check (publication_status in ('draft', 'published', 'withdrawn')),
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id, storage_path)
);

create table if not exists public.catalog_external_ids (
  id uuid primary key default extensions.gen_random_uuid(),
  source_id uuid not null references public.catalog_sources(id) on delete restrict,
  entity_type text not null check (entity_type in ('brand', 'ingredient', 'product', 'package', 'recipe', 'recipe_version')),
  entity_id uuid not null,
  external_id text not null check (btrim(external_id) <> ''),
  source_url text check (source_url is null or source_url ~ '^https?://'),
  retrieved_at timestamptz not null default now(),
  raw_checksum_sha256 text check (raw_checksum_sha256 is null or raw_checksum_sha256 ~ '^[a-f0-9]{64}$'),
  unique (source_id, entity_type, external_id),
  unique (source_id, entity_type, entity_id)
);

create table if not exists public.catalog_audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid,
  import_batch_id uuid references public.catalog_import_batches(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null check (action in ('create', 'update', 'review', 'publish', 'withdraw', 'merge', 'reject', 'import')),
  before_state jsonb,
  after_state jsonb,
  reason text,
  created_at timestamptz not null default now(),
  check (before_state is null or jsonb_typeof(before_state) = 'object'),
  check (after_state is null or jsonb_typeof(after_state) = 'object')
);

create unique index if not exists catalog_products_brand_name_expression_uidx
  on public.catalog_products (brand_id, lower(name), coalesce(lower(expression), ''));
create unique index if not exists catalog_product_packages_identity_uidx
  on public.catalog_product_packages (product_id, coalesce(volume_ml, 0), coalesce(lower(package_label), ''), coalesce(market_code, ''));

create index if not exists catalog_brands_search_idx on public.catalog_brands using gin (search_document);
create index if not exists catalog_brands_name_trgm_idx on public.catalog_brands using gin (name extensions.gin_trgm_ops);
create index if not exists catalog_ingredients_search_idx on public.catalog_ingredients using gin (search_document);
create index if not exists catalog_ingredients_name_trgm_idx on public.catalog_ingredients using gin (canonical_name extensions.gin_trgm_ops);
create index if not exists catalog_products_search_idx on public.catalog_products using gin (search_document);
create index if not exists catalog_products_name_trgm_idx on public.catalog_products using gin (name extensions.gin_trgm_ops);
create index if not exists catalog_recipe_versions_search_idx on public.catalog_recipe_versions using gin (search_document);
create index if not exists catalog_recipe_versions_name_trgm_idx on public.catalog_recipe_versions using gin (name extensions.gin_trgm_ops);

create index if not exists catalog_ingredients_parent_idx on public.catalog_ingredients (parent_id);
create index if not exists catalog_ingredients_brand_idx on public.catalog_ingredients (brand_id) where brand_id is not null;
create index if not exists catalog_ingredient_aliases_lookup_idx on public.catalog_ingredient_aliases (locale, normalized_alias) where review_status = 'approved';
create index if not exists catalog_products_brand_idx on public.catalog_products (brand_id, status);
create index if not exists catalog_products_ingredient_idx on public.catalog_products (ingredient_id, status);
create index if not exists catalog_product_packages_product_idx on public.catalog_product_packages (product_id, status);
create index if not exists catalog_product_barcodes_package_idx on public.catalog_product_barcodes (package_id);
create index if not exists catalog_recipe_versions_publication_idx on public.catalog_recipe_versions (publication_status, editorial_priority desc, name);
create index if not exists catalog_recipe_versions_recipe_idx on public.catalog_recipe_versions (recipe_id, version desc);
create index if not exists catalog_recipe_requirements_version_idx on public.catalog_recipe_requirements (recipe_version_id, position);
create index if not exists catalog_requirement_options_ingredient_idx on public.catalog_recipe_requirement_options (ingredient_id, requirement_id);
create index if not exists catalog_recipe_steps_version_idx on public.catalog_recipe_steps (recipe_version_id, position);
create index if not exists catalog_recipe_tags_tag_idx on public.catalog_recipe_tags (tag_id, recipe_version_id);
create index if not exists catalog_external_ids_entity_idx on public.catalog_external_ids (entity_type, entity_id);
create index if not exists catalog_audit_events_entity_idx on public.catalog_audit_events (entity_type, entity_id, created_at desc);

create or replace function public.catalog_guard_recipe_version_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if old.publication_status in ('published', 'withdrawn') then
      raise exception 'Published or withdrawn recipe versions cannot be deleted.';
    end if;
    return old;
  end if;

  if old.publication_status in ('published', 'withdrawn') then
    if (to_jsonb(new) - array['publication_status', 'withdrawn_at', 'updated_at'])
       is distinct from
       (to_jsonb(old) - array['publication_status', 'withdrawn_at', 'updated_at']) then
      raise exception 'Published recipe versions are immutable; create a new version instead.';
    end if;

    if old.publication_status = 'published' and new.publication_status not in ('published', 'withdrawn') then
      raise exception 'A published recipe version can only remain published or be withdrawn.';
    end if;

    if old.publication_status = 'withdrawn' and new.publication_status <> 'withdrawn' then
      raise exception 'A withdrawn recipe version cannot be republished; create a new version.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.catalog_validate_recipe_publication()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' and new.publication_status in ('published', 'withdrawn') then
    raise exception 'Insert recipe versions as draft or reviewed, add their children, then publish by update.';
  end if;

  if new.publication_status = 'published' and old.publication_status is distinct from 'published' then
    if not exists (
      select 1 from public.catalog_recipe_requirements r where r.recipe_version_id = new.id
    ) then
      raise exception 'A published recipe version needs at least one requirement.';
    end if;

    if exists (
      select 1
      from public.catalog_recipe_requirements r
      where r.recipe_version_id = new.id
        and not exists (
          select 1 from public.catalog_recipe_requirement_options o where o.requirement_id = r.id
        )
    ) then
      raise exception 'Every published recipe requirement needs at least one ingredient option.';
    end if;

    if not exists (
      select 1 from public.catalog_recipe_steps s where s.recipe_version_id = new.id
    ) then
      raise exception 'A published recipe version needs at least one step.';
    end if;

    if not exists (
      select 1 from public.catalog_recipe_flavour_profiles f where f.recipe_version_id = new.id
    ) then
      raise exception 'A published recipe version needs a flavour profile.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.catalog_guard_published_recipe_child()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  payload jsonb;
  version_id uuid;
  version_status text;
begin
  payload := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  version_id := (payload ->> tg_argv[0])::uuid;

  select publication_status into version_status
  from public.catalog_recipe_versions
  where id = version_id;

  if version_status in ('published', 'withdrawn') then
    raise exception 'Published recipe version children are immutable; create a new version instead.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create or replace function public.catalog_guard_published_requirement_option()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  payload jsonb;
  version_status text;
begin
  payload := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  select v.publication_status into version_status
  from public.catalog_recipe_requirements r
  join public.catalog_recipe_versions v on v.id = r.recipe_version_id
  where r.id = (payload ->> 'requirement_id')::uuid;

  if version_status in ('published', 'withdrawn') then
    raise exception 'Published recipe requirement options are immutable; create a new version instead.';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists catalog_recipe_versions_guard_update on public.catalog_recipe_versions;
create trigger catalog_recipe_versions_guard_update
before update or delete on public.catalog_recipe_versions
for each row execute function public.catalog_guard_recipe_version_update();

drop trigger if exists catalog_recipe_versions_validate_publication on public.catalog_recipe_versions;
create trigger catalog_recipe_versions_validate_publication
before insert or update on public.catalog_recipe_versions
for each row execute function public.catalog_validate_recipe_publication();

drop trigger if exists catalog_requirements_immutable on public.catalog_recipe_requirements;
create trigger catalog_requirements_immutable
before insert or update or delete on public.catalog_recipe_requirements
for each row execute function public.catalog_guard_published_recipe_child('recipe_version_id');

drop trigger if exists catalog_steps_immutable on public.catalog_recipe_steps;
create trigger catalog_steps_immutable
before insert or update or delete on public.catalog_recipe_steps
for each row execute function public.catalog_guard_published_recipe_child('recipe_version_id');

drop trigger if exists catalog_recipe_equipment_immutable on public.catalog_recipe_equipment;
create trigger catalog_recipe_equipment_immutable
before insert or update or delete on public.catalog_recipe_equipment
for each row execute function public.catalog_guard_published_recipe_child('recipe_version_id');

drop trigger if exists catalog_recipe_tags_immutable on public.catalog_recipe_tags;
create trigger catalog_recipe_tags_immutable
before insert or update or delete on public.catalog_recipe_tags
for each row execute function public.catalog_guard_published_recipe_child('recipe_version_id');

drop trigger if exists catalog_flavour_profiles_immutable on public.catalog_recipe_flavour_profiles;
create trigger catalog_flavour_profiles_immutable
before insert or update or delete on public.catalog_recipe_flavour_profiles
for each row execute function public.catalog_guard_published_recipe_child('recipe_version_id');

drop trigger if exists catalog_requirement_options_immutable on public.catalog_recipe_requirement_options;
create trigger catalog_requirement_options_immutable
before insert or update or delete on public.catalog_recipe_requirement_options
for each row execute function public.catalog_guard_published_requirement_option();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'catalog_sources',
    'catalog_brands',
    'catalog_ingredients',
    'catalog_products',
    'catalog_product_packages',
    'catalog_recipe_families',
    'catalog_recipes',
    'catalog_recipe_versions'
  ] loop
    execute format('drop trigger if exists %I on public.%I', table_name || '_touch_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.catalog_touch_updated_at()',
      table_name || '_touch_updated_at',
      table_name
    );
  end loop;
end;
$$;

alter table public.catalog_sources enable row level security;
alter table public.catalog_import_batches enable row level security;
alter table public.catalog_brands enable row level security;
alter table public.catalog_ingredients enable row level security;
alter table public.catalog_ingredient_aliases enable row level security;
alter table public.catalog_ingredient_relations enable row level security;
alter table public.catalog_products enable row level security;
alter table public.catalog_product_packages enable row level security;
alter table public.catalog_product_barcodes enable row level security;
alter table public.catalog_recipe_families enable row level security;
alter table public.catalog_recipes enable row level security;
alter table public.catalog_recipe_versions enable row level security;
alter table public.catalog_recipe_requirements enable row level security;
alter table public.catalog_recipe_requirement_options enable row level security;
alter table public.catalog_recipe_steps enable row level security;
alter table public.catalog_equipment enable row level security;
alter table public.catalog_recipe_equipment enable row level security;
alter table public.catalog_tags enable row level security;
alter table public.catalog_recipe_tags enable row level security;
alter table public.catalog_recipe_flavour_profiles enable row level security;
alter table public.catalog_media enable row level security;
alter table public.catalog_external_ids enable row level security;
alter table public.catalog_audit_events enable row level security;

drop policy if exists catalog_sources_public_read on public.catalog_sources;
create policy catalog_sources_public_read on public.catalog_sources for select to public using (status = 'active');

drop policy if exists catalog_brands_public_read on public.catalog_brands;
create policy catalog_brands_public_read on public.catalog_brands for select to public using (status = 'active');

drop policy if exists catalog_ingredients_public_read on public.catalog_ingredients;
create policy catalog_ingredients_public_read on public.catalog_ingredients for select to public using (status = 'active');

drop policy if exists catalog_aliases_public_read on public.catalog_ingredient_aliases;
create policy catalog_aliases_public_read on public.catalog_ingredient_aliases for select to public
using (
  review_status = 'approved' and exists (
    select 1 from public.catalog_ingredients i where i.id = ingredient_id and i.status = 'active'
  )
);

drop policy if exists catalog_relations_public_read on public.catalog_ingredient_relations;
create policy catalog_relations_public_read on public.catalog_ingredient_relations for select to public using (review_status = 'approved');

drop policy if exists catalog_products_public_read on public.catalog_products;
create policy catalog_products_public_read on public.catalog_products for select to public using (status = 'published');

drop policy if exists catalog_product_packages_public_read on public.catalog_product_packages;
create policy catalog_product_packages_public_read on public.catalog_product_packages for select to public
using (
  status = 'active' and exists (
    select 1 from public.catalog_products p where p.id = product_id and p.status = 'published'
  )
);

drop policy if exists catalog_product_barcodes_public_read on public.catalog_product_barcodes;
create policy catalog_product_barcodes_public_read on public.catalog_product_barcodes for select to public
using (
  verification_status in ('provider_verified', 'editor_verified') and exists (
    select 1
    from public.catalog_product_packages pp
    join public.catalog_products p on p.id = pp.product_id
    where pp.id = package_id and pp.status = 'active' and p.status = 'published'
  )
);

drop policy if exists catalog_recipe_families_public_read on public.catalog_recipe_families;
create policy catalog_recipe_families_public_read on public.catalog_recipe_families for select to public using (status = 'active');

drop policy if exists catalog_recipes_public_read on public.catalog_recipes;
create policy catalog_recipes_public_read on public.catalog_recipes for select to public
using (
  status = 'active' and exists (
    select 1 from public.catalog_recipe_versions v where v.recipe_id = id and v.publication_status = 'published'
  )
);

drop policy if exists catalog_recipe_versions_public_read on public.catalog_recipe_versions;
create policy catalog_recipe_versions_public_read on public.catalog_recipe_versions for select to public using (publication_status = 'published');

drop policy if exists catalog_requirements_public_read on public.catalog_recipe_requirements;
create policy catalog_requirements_public_read on public.catalog_recipe_requirements for select to public
using (exists (
  select 1 from public.catalog_recipe_versions v where v.id = recipe_version_id and v.publication_status = 'published'
));

drop policy if exists catalog_requirement_options_public_read on public.catalog_recipe_requirement_options;
create policy catalog_requirement_options_public_read on public.catalog_recipe_requirement_options for select to public
using (exists (
  select 1
  from public.catalog_recipe_requirements r
  join public.catalog_recipe_versions v on v.id = r.recipe_version_id
  where r.id = requirement_id and v.publication_status = 'published'
));

drop policy if exists catalog_steps_public_read on public.catalog_recipe_steps;
create policy catalog_steps_public_read on public.catalog_recipe_steps for select to public
using (exists (
  select 1 from public.catalog_recipe_versions v where v.id = recipe_version_id and v.publication_status = 'published'
));

drop policy if exists catalog_equipment_public_read on public.catalog_equipment;
create policy catalog_equipment_public_read on public.catalog_equipment for select to public using (status = 'active');

drop policy if exists catalog_recipe_equipment_public_read on public.catalog_recipe_equipment;
create policy catalog_recipe_equipment_public_read on public.catalog_recipe_equipment for select to public
using (exists (
  select 1 from public.catalog_recipe_versions v where v.id = recipe_version_id and v.publication_status = 'published'
));

drop policy if exists catalog_tags_public_read on public.catalog_tags;
create policy catalog_tags_public_read on public.catalog_tags for select to public using (status = 'active');

drop policy if exists catalog_recipe_tags_public_read on public.catalog_recipe_tags;
create policy catalog_recipe_tags_public_read on public.catalog_recipe_tags for select to public
using (exists (
  select 1 from public.catalog_recipe_versions v where v.id = recipe_version_id and v.publication_status = 'published'
));

drop policy if exists catalog_flavour_profiles_public_read on public.catalog_recipe_flavour_profiles;
create policy catalog_flavour_profiles_public_read on public.catalog_recipe_flavour_profiles for select to public
using (exists (
  select 1 from public.catalog_recipe_versions v where v.id = recipe_version_id and v.publication_status = 'published'
));

drop policy if exists catalog_media_public_read on public.catalog_media;
create policy catalog_media_public_read on public.catalog_media for select to public
using (publication_status = 'published' and rights_verified_at is not null);

create or replace view public.catalog_published_recipe_search
with (security_invoker = true)
as
select
  r.id as recipe_id,
  r.slug,
  v.id as recipe_version_id,
  v.version,
  v.name,
  v.eyebrow,
  v.description,
  v.preparation_minutes,
  v.difficulty,
  v.editorial_priority,
  v.search_document,
  v.published_at
from public.catalog_recipes r
join public.catalog_recipe_versions v on v.recipe_id = r.id
where r.status = 'active' and v.publication_status = 'published';

comment on table public.catalog_products is 'A liquid or expression. Bottle size and barcode belong to catalog_product_packages and catalog_product_barcodes.';
comment on table public.catalog_recipe_versions is 'Immutable after publication; material recipe changes require a new version.';
comment on table public.catalog_import_batches is 'Service-only import provenance and reconciliation metadata. No public RLS policy is intentional.';
comment on table public.catalog_audit_events is 'Service-only catalogue audit trail. No public RLS policy is intentional.';
comment on table public.catalog_external_ids is 'Service-only source identity map. No public RLS policy is intentional.';

commit;
