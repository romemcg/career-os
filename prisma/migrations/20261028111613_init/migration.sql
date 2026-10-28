-- CreateEnum
CREATE TYPE "actor_type" AS ENUM ('owner', 'system', 'ai_service', 'background_worker');

-- CreateEnum
CREATE TYPE "fact_type" AS ENUM ('employment', 'education', 'certification', 'skill', 'achievement', 'project');

-- CreateEnum
CREATE TYPE "verification_status" AS ENUM ('unverified', 'verified', 'rejected', 'superseded');

-- CreateEnum
CREATE TYPE "source_type" AS ENUM ('document', 'url', 'reference', 'owner_attestation');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "password_changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "user_agent" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_profiles" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "headline" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "career_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fact_sources" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "source_type" "source_type" NOT NULL,
    "title" TEXT NOT NULL,
    "document_id" UUID,
    "reference" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "fact_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_facts" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "fact_type" "fact_type" NOT NULL,
    "content_json" JSONB NOT NULL,
    "content_schema_version" INTEGER NOT NULL DEFAULT 1,
    "verification_status" "verification_status" NOT NULL DEFAULT 'unverified',
    "source_id" UUID,
    "supersedes_fact_id" UUID,
    "rejection_reason" TEXT,
    "verified_at" TIMESTAMPTZ(6),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "career_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_fact_revisions" (
    "id" UUID NOT NULL,
    "fact_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "change_type" TEXT NOT NULL,
    "content_json" JSONB NOT NULL,
    "verification_status" "verification_status" NOT NULL,
    "source_id" UUID,
    "note" TEXT,
    "actor_type" "actor_type" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "career_fact_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "owner_id" UUID,
    "actor_type" "actor_type" NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "request_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "response_status" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "career_profiles_owner_id_key" ON "career_profiles"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents"("storage_key");

-- CreateIndex
CREATE INDEX "documents_owner_id_created_at_idx" ON "documents"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "documents_owner_id_sha256_idx" ON "documents"("owner_id", "sha256");

-- CreateIndex
CREATE INDEX "fact_sources_owner_id_created_at_idx" ON "fact_sources"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "career_facts_owner_id_verification_status_idx" ON "career_facts"("owner_id", "verification_status");

-- CreateIndex
CREATE INDEX "career_facts_owner_id_fact_type_idx" ON "career_facts"("owner_id", "fact_type");

-- CreateIndex
CREATE INDEX "career_facts_owner_id_created_at_id_idx" ON "career_facts"("owner_id", "created_at", "id");

-- CreateIndex
CREATE INDEX "career_fact_revisions_owner_id_idx" ON "career_fact_revisions"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "career_fact_revisions_fact_id_revision_key" ON "career_fact_revisions"("fact_id", "revision");

-- CreateIndex
CREATE INDEX "audit_logs_owner_id_created_at_idx" ON "audit_logs"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_owner_id_operation_key_key" ON "idempotency_keys"("owner_id", "operation", "key");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_profiles" ADD CONSTRAINT "career_profiles_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sources" ADD CONSTRAINT "fact_sources_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fact_sources" ADD CONSTRAINT "fact_sources_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_facts" ADD CONSTRAINT "career_facts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_facts" ADD CONSTRAINT "career_facts_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "fact_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_facts" ADD CONSTRAINT "career_facts_supersedes_fact_id_fkey" FOREIGN KEY ("supersedes_fact_id") REFERENCES "career_facts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_fact_revisions" ADD CONSTRAINT "career_fact_revisions_fact_id_fkey" FOREIGN KEY ("fact_id") REFERENCES "career_facts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_fact_revisions" ADD CONSTRAINT "career_fact_revisions_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_fact_revisions" ADD CONSTRAINT "career_fact_revisions_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "fact_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
