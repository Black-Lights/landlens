-- LandLens — Row Level Security policies
-- Apply ONCE in the Supabase SQL editor after `post-init.sql`.
--
-- Why this exists:
--   Supabase exposes the database directly to the browser via the anon key.
--   Without RLS, any signed-in user could `select * from saved_parcels` and
--   see everyone else's bookmarks. These policies pin every read and write to
--   `auth.uid()` — the JWT subject of the calling user.
--
--   The app's API routes use the service role only for ownership-record
--   read endpoints and the export route. All user-scoped tables are accessed
--   with the user's JWT via @supabase/ssr.

-- ────────────────────────────────────────────────────────────────────────────
-- saved_parcels — users see + manage only their own rows
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE saved_parcels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_parcels select own" ON saved_parcels;
CREATE POLICY "saved_parcels select own"
  ON saved_parcels FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_parcels insert own" ON saved_parcels;
CREATE POLICY "saved_parcels insert own"
  ON saved_parcels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_parcels update own" ON saved_parcels;
CREATE POLICY "saved_parcels update own"
  ON saved_parcels FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "saved_parcels delete own" ON saved_parcels;
CREATE POLICY "saved_parcels delete own"
  ON saved_parcels FOR DELETE
  USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- access_log — write-only from clients, read restricted to service role
-- ────────────────────────────────────────────────────────────────────────────
--
-- The audit log captures every parcel detail view. We let the user's own JWT
-- insert their own row (so logging works without the service key) but never
-- read or modify anything. Admins read via the service role, which bypasses
-- RLS entirely.

ALTER TABLE access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "access_log insert anyone" ON access_log;
CREATE POLICY "access_log insert anyone"
  ON access_log FOR INSERT
  WITH CHECK (
    -- Either anonymous (user_id IS NULL) or the row matches the caller.
    user_id IS NULL OR auth.uid() = user_id
  );

-- No SELECT / UPDATE / DELETE policies — RLS denies by default, so only the
-- service role (which bypasses RLS) can read or mutate audit history.

-- ────────────────────────────────────────────────────────────────────────────
-- parcel_corrections — owner sees their own pending corrections; admin (svc
-- role) sees all. Approved corrections are public via the parcels table itself,
-- so the rows here are intentionally hidden from other users.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE parcel_corrections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "parcel_corrections select own" ON parcel_corrections;
CREATE POLICY "parcel_corrections select own"
  ON parcel_corrections FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "parcel_corrections insert own" ON parcel_corrections;
CREATE POLICY "parcel_corrections insert own"
  ON parcel_corrections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Updates + deletes only via service role (admin review queue, Sprint 8+).

-- ────────────────────────────────────────────────────────────────────────────
-- admin_api_keys + admin_assistant_* — owner-scoped, used by the admin
-- assistant (Sprint 13). Locked down now so the schema is safe to ship.
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE admin_api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_api_keys owner all" ON admin_api_keys;
CREATE POLICY "admin_api_keys owner all"
  ON admin_api_keys FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE admin_assistant_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_assistant_conversations owner all" ON admin_assistant_conversations;
CREATE POLICY "admin_assistant_conversations owner all"
  ON admin_assistant_conversations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE admin_assistant_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_assistant_messages owner all" ON admin_assistant_messages;
CREATE POLICY "admin_assistant_messages owner all"
  ON admin_assistant_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_assistant_conversations c
      WHERE c.id = admin_assistant_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_assistant_conversations c
      WHERE c.id = admin_assistant_messages.conversation_id
        AND c.user_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- Public read-only tables — leave RLS DISABLED so the anon key can still
-- serve the map without a session.
--   parcels, admin_boundaries, ownership_records, encumbrances,
--   api_keys, api_usage
-- They are written only from the service role / migration scripts.
-- ────────────────────────────────────────────────────────────────────────────
