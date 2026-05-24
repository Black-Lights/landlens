-- LandLens — supplemental DDL Prisma can't manage.
-- Run this ONCE in the Supabase SQL editor (or via psql) AFTER
-- `prisma migrate dev --name init` completes.
--
-- Why this exists:
--   Prisma supports `Unsupported("geometry(...)")` columns but cannot
--   emit GIST indexes, GIN trigram indexes, generated columns, partial
--   indexes, or CHECK constraints for them. We add those here.

-- ─────────────────────────────────────────────────────────────────────
-- Generated columns
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS area_acres DECIMAL
    GENERATED ALWAYS AS (area_sqm / 4046.86) STORED;

ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS area_hectares DECIMAL
    GENERATED ALWAYS AS (area_sqm / 10000) STORED;

ALTER TABLE ownership_records
  ADD COLUMN IF NOT EXISTS is_current BOOLEAN
    GENERATED ALWAYS AS (transfer_date IS NULL) STORED;

-- ─────────────────────────────────────────────────────────────────────
-- CHECK constraints
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE admin_boundaries
  ADD CONSTRAINT admin_boundaries_level_check
    CHECK (level IN ('country', 'state', 'district', 'tehsil', 'village'));

ALTER TABLE parcels
  ADD CONSTRAINT parcels_land_type_check
    CHECK (land_type IS NULL OR land_type IN (
      'agricultural', 'residential', 'commercial', 'industrial',
      'forest', 'government', 'water_body', 'wasteland', 'mixed'
    ));

ALTER TABLE parcels
  ADD CONSTRAINT parcels_boundary_source_check
    CHECK (boundary_source IN (
      'govt_bhunaksha', 'fmb_reconstructed', 'ai_with_constraints',
      'osm', 'ai_only', 'user_corrected', 'mock'
    ));

ALTER TABLE parcel_corrections
  ADD CONSTRAINT parcel_corrections_status_check
    CHECK (status IS NULL OR status IN ('pending', 'approved', 'rejected'));

ALTER TABLE ownership_records
  ADD CONSTRAINT ownership_records_type_check
    CHECK (ownership_type IS NULL OR ownership_type IN (
      'sole', 'joint', 'huf', 'government', 'trust', 'company'
    ));

ALTER TABLE encumbrances
  ADD CONSTRAINT encumbrances_type_check
    CHECK (type IS NULL OR type IN (
      'mortgage', 'court_case', 'dispute', 'easement', 'lien', 'attachment'
    ));

ALTER TABLE encumbrances
  ADD CONSTRAINT encumbrances_status_check
    CHECK (status IS NULL OR status IN ('active', 'resolved', 'pending'));

ALTER TABLE admin_api_keys
  ADD CONSTRAINT admin_api_keys_provider_check
    CHECK (provider IN ('anthropic', 'openai', 'google', 'mistral'));

ALTER TABLE admin_assistant_messages
  ADD CONSTRAINT admin_assistant_messages_role_check
    CHECK (role IS NULL OR role IN ('user', 'assistant', 'tool'));

ALTER TABLE api_keys
  ADD CONSTRAINT api_keys_tier_check
    CHECK (tier IN ('community', 'developer', 'business', 'enterprise'));

-- ─────────────────────────────────────────────────────────────────────
-- Spatial indexes (GIST)
-- ─────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS admin_geom_idx
  ON admin_boundaries USING GIST(geom);

CREATE INDEX IF NOT EXISTS parcels_geom_idx
  ON parcels USING GIST(geom);

CREATE INDEX IF NOT EXISTS parcels_centroid_idx
  ON parcels USING GIST(centroid);

-- ─────────────────────────────────────────────────────────────────────
-- Trigram (fuzzy search) indexes
-- ─────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS admin_name_trgm_idx
  ON admin_boundaries USING GIN(name_en gin_trgm_ops);

CREATE INDEX IF NOT EXISTS ownership_name_trgm_idx
  ON ownership_records USING GIN(owner_name_en gin_trgm_ops);

-- ─────────────────────────────────────────────────────────────────────
-- Partial indexes for hot subsets
-- ─────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS parcels_ulpin_idx
  ON parcels(ulpin) WHERE ulpin IS NOT NULL;

CREATE INDEX IF NOT EXISTS parcels_unverified_idx
  ON parcels(needs_verification) WHERE needs_verification = true;

CREATE INDEX IF NOT EXISTS ownership_current_idx
  ON ownership_records(parcel_id) WHERE is_current = true;

CREATE INDEX IF NOT EXISTS encumbrances_active_idx
  ON encumbrances(parcel_id) WHERE status = 'active';
