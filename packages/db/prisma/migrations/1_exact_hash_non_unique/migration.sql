-- exact_hash is a content fingerprint, not a row identity.
-- Multiple ATS postings can share a title+location hash.
DROP INDEX IF EXISTS "Job_exact_hash_key";

CREATE INDEX "Job_exact_hash_idx" ON "Job"("exact_hash");
