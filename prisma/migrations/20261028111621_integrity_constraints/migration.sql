-- Integrity rules that Prisma's schema language cannot express.

ALTER TABLE "career_profiles" ADD CONSTRAINT "career_profiles_revision_positive" CHECK ("revision" > 0);
ALTER TABLE "career_facts" ADD CONSTRAINT "career_facts_revision_positive" CHECK ("revision" > 0);
ALTER TABLE "career_facts" ADD CONSTRAINT "career_facts_content_is_object" CHECK (jsonb_typeof("content_json") = 'object');
ALTER TABLE "career_facts" ADD CONSTRAINT "career_facts_no_self_supersede" CHECK ("supersedes_fact_id" IS NULL OR "supersedes_fact_id" <> "id");
-- A verified fact must cite a source.
ALTER TABLE "career_facts" ADD CONSTRAINT "career_facts_verified_requires_source" CHECK ("verification_status" <> 'verified' OR "source_id" IS NOT NULL);
-- A rejected fact must record why.
ALTER TABLE "career_facts" ADD CONSTRAINT "career_facts_rejected_requires_reason" CHECK ("verification_status" <> 'rejected' OR length(coalesce("rejection_reason", '')) > 0);

ALTER TABLE "documents" ADD CONSTRAINT "documents_size_non_negative" CHECK ("size_bytes" >= 0);
ALTER TABLE "documents" ADD CONSTRAINT "documents_sha256_hex" CHECK ("sha256" ~ '^[0-9a-f]{64}$');

ALTER TABLE "fact_sources" ADD CONSTRAINT "fact_sources_document_type_has_document" CHECK ("source_type" <> 'document' OR "document_id" IS NOT NULL);

-- Fact revision history and audit logs are append-only.
CREATE OR REPLACE FUNCTION careeros_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "career_fact_revisions_append_only"
  BEFORE UPDATE OR DELETE ON "career_fact_revisions"
  FOR EACH ROW WHEN (pg_trigger_depth() = 0)
  EXECUTE FUNCTION careeros_reject_mutation();

-- Audit rows may only change through ON DELETE SET NULL of their owner.
CREATE TRIGGER "audit_logs_no_delete"
  BEFORE DELETE ON "audit_logs"
  FOR EACH ROW
  EXECUTE FUNCTION careeros_reject_mutation();
