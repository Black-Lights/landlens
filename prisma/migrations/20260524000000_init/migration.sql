-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgsodium";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateTable
CREATE TABLE "admin_boundaries" (
    "id" UUID NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_hi" TEXT,
    "name_local" TEXT,
    "level" TEXT NOT NULL,
    "parent_id" UUID,
    "lgd_code" TEXT,
    "geom" geometry(MultiPolygon, 4326) NOT NULL,
    "centroid" geometry(Point, 4326),
    "area_sqkm" DECIMAL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_boundaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcels" (
    "id" UUID NOT NULL,
    "ulpin" TEXT,
    "khasra_no" TEXT,
    "survey_no" TEXT,
    "sub_division" TEXT,
    "village_id" UUID,
    "area_sqm" DECIMAL NOT NULL,
    "land_type" TEXT,
    "land_use" TEXT,
    "classification" TEXT,
    "geom" geometry(Polygon, 4326) NOT NULL,
    "centroid" geometry(Point, 4326),
    "source_portal" TEXT,
    "data_year" INTEGER,
    "raw_data" JSONB,
    "boundary_source" TEXT NOT NULL DEFAULT 'mock',
    "confidence_score" DECIMAL(3,2),
    "ai_model_version" TEXT,
    "needs_verification" BOOLEAN NOT NULL DEFAULT false,
    "last_verified_at" TIMESTAMPTZ(6),
    "verified_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parcels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcel_corrections" (
    "id" UUID NOT NULL,
    "parcel_id" UUID NOT NULL,
    "user_id" UUID,
    "previousGeom" geometry(Polygon, 4326),
    "newGeom" geometry(Polygon, 4326),
    "reason" TEXT,
    "status" TEXT,
    "reviewed_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parcel_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ownership_records" (
    "id" UUID NOT NULL,
    "parcel_id" UUID NOT NULL,
    "owner_name" TEXT NOT NULL,
    "owner_name_en" TEXT,
    "owner_name_masked" TEXT,
    "father_or_spouse" TEXT,
    "ownership_type" TEXT,
    "share_fraction" TEXT,
    "mutation_no" TEXT,
    "registration_date" DATE,
    "transfer_date" DATE,
    "document_no" TEXT,
    "document_type" TEXT,
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ownership_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "encumbrances" (
    "id" UUID NOT NULL,
    "parcel_id" UUID NOT NULL,
    "type" TEXT,
    "party_name" TEXT,
    "description" TEXT,
    "amount" DECIMAL,
    "start_date" DATE,
    "end_date" DATE,
    "status" TEXT,
    "reference_no" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "encumbrances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_parcels" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "parcel_id" UUID NOT NULL,
    "label" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_parcels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_log" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "parcel_id" UUID,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "accessed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_api_keys" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "encrypted_key" BYTEA NOT NULL,
    "key_label" TEXT,
    "last_used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_assistant_conversations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_assistant_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_assistant_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" TEXT,
    "content" JSONB NOT NULL,
    "tokens_used" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_assistant_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "owner_email" TEXT,
    "organization" TEXT,
    "tier" TEXT DEFAULT 'community',
    "rate_limit_per_min" INTEGER NOT NULL DEFAULT 60,
    "monthly_quota" INTEGER,
    "used_this_month" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage" (
    "id" UUID NOT NULL,
    "api_key_id" UUID,
    "endpoint" TEXT,
    "status_code" INTEGER,
    "response_ms" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_boundaries_lgd_code_key" ON "admin_boundaries"("lgd_code");

-- CreateIndex
CREATE INDEX "admin_parent_idx" ON "admin_boundaries"("parent_id");

-- CreateIndex
CREATE INDEX "admin_level_idx" ON "admin_boundaries"("level");

-- CreateIndex
CREATE UNIQUE INDEX "parcels_ulpin_key" ON "parcels"("ulpin");

-- CreateIndex
CREATE INDEX "parcels_village_idx" ON "parcels"("village_id");

-- CreateIndex
CREATE INDEX "parcels_khasra_idx" ON "parcels"("khasra_no");

-- CreateIndex
CREATE INDEX "parcels_land_type_idx" ON "parcels"("land_type");

-- CreateIndex
CREATE INDEX "parcels_source_idx" ON "parcels"("boundary_source");

-- CreateIndex
CREATE INDEX "corrections_parcel_idx" ON "parcel_corrections"("parcel_id");

-- CreateIndex
CREATE INDEX "corrections_status_idx" ON "parcel_corrections"("status");

-- CreateIndex
CREATE INDEX "ownership_parcel_idx" ON "ownership_records"("parcel_id");

-- CreateIndex
CREATE INDEX "encumbrances_parcel_idx" ON "encumbrances"("parcel_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_parcels_user_id_parcel_id_key" ON "saved_parcels"("user_id", "parcel_id");

-- CreateIndex
CREATE INDEX "access_log_parcel_idx" ON "access_log"("parcel_id");

-- CreateIndex
CREATE INDEX "access_log_user_idx" ON "access_log"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "admin_api_keys_user_id_provider_key" ON "admin_api_keys"("user_id", "provider");

-- CreateIndex
CREATE INDEX "assistant_msgs_conv_idx" ON "admin_assistant_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "usage_key_time_idx" ON "api_usage"("api_key_id", "created_at");

-- AddForeignKey
ALTER TABLE "admin_boundaries" ADD CONSTRAINT "admin_boundaries_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "admin_boundaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_village_id_fkey" FOREIGN KEY ("village_id") REFERENCES "admin_boundaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcel_corrections" ADD CONSTRAINT "parcel_corrections_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ownership_records" ADD CONSTRAINT "ownership_records_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "encumbrances" ADD CONSTRAINT "encumbrances_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_parcels" ADD CONSTRAINT "saved_parcels_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_log" ADD CONSTRAINT "access_log_parcel_id_fkey" FOREIGN KEY ("parcel_id") REFERENCES "parcels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_assistant_messages" ADD CONSTRAINT "admin_assistant_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "admin_assistant_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

