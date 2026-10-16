-- CreateEnum
CREATE TYPE "AtsType" AS ENUM ('greenhouse', 'ashby', 'lever', 'workable', 'smartrecruiters', 'workday', 'icims', 'successfactors', 'taleo', 'unknown');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('active', 'inactive', 'dead', 'blocked');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('discovered', 'active', 'updated', 'closed', 'archived');

-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('remote', 'hybrid', 'onsite', 'unknown');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('full_time', 'part_time', 'contract', 'internship', 'unknown');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "ats_type" "AtsType" NOT NULL,
    "ats_token" TEXT NOT NULL,
    "poll_interval_hours" INTEGER NOT NULL DEFAULT 4,
    "next_poll_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "CompanyStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "source_ats" "AtsType" NOT NULL,
    "company_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "title_normalized" TEXT NOT NULL,
    "seniority" TEXT,
    "role_family" TEXT,
    "description_text" TEXT,
    "description_html" TEXT,
    "r2_key" TEXT,
    "location_raw" TEXT,
    "location_type" "LocationType" NOT NULL DEFAULT 'unknown',
    "location_country" TEXT,
    "location_region" TEXT,
    "employment_type" "EmploymentType" NOT NULL DEFAULT 'unknown',
    "department" TEXT,
    "team" TEXT,
    "tech_stack" TEXT[],
    "tags" TEXT[],
    "comp_min" INTEGER,
    "comp_max" INTEGER,
    "comp_currency" TEXT,
    "has_equity" BOOLEAN NOT NULL DEFAULT false,
    "apply_url" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "exact_hash" TEXT NOT NULL,
    "role_family_hash" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'active',
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source_created_at" TIMESTAMP(3),
    "source_updated_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobSnapshot" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "diff_keys" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrawlLog" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "ats_type" "AtsType" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "jobs_found" INTEGER NOT NULL DEFAULT 0,
    "jobs_new" INTEGER NOT NULL DEFAULT 0,
    "jobs_updated" INTEGER NOT NULL DEFAULT 0,
    "jobs_closed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrawlLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "min_match_score" INTEGER NOT NULL DEFAULT 0,
    "notify_email" BOOLEAN NOT NULL DEFAULT true,
    "notify_frequency" TEXT NOT NULL DEFAULT 'daily',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobAlert" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "saved_search_id" TEXT NOT NULL,
    "match_score" INTEGER,
    "notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "requests_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX "Company_next_poll_at_status_idx" ON "Company"("next_poll_at", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Job_exact_hash_key" ON "Job"("exact_hash");

-- CreateIndex
CREATE INDEX "Job_company_id_status_idx" ON "Job"("company_id", "status");

-- CreateIndex
CREATE INDEX "Job_role_family_hash_idx" ON "Job"("role_family_hash");

-- CreateIndex
CREATE INDEX "Job_status_first_seen_at_idx" ON "Job"("status", "first_seen_at");

-- CreateIndex
CREATE INDEX "Job_source_ats_status_idx" ON "Job"("source_ats", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Job_source_id_source_ats_company_id_key" ON "Job"("source_id", "source_ats", "company_id");

-- CreateIndex
CREATE INDEX "JobSnapshot_job_id_idx" ON "JobSnapshot"("job_id");

-- CreateIndex
CREATE INDEX "CrawlLog_company_id_started_at_idx" ON "CrawlLog"("company_id", "started_at");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "JobAlert_job_id_saved_search_id_key" ON "JobAlert"("job_id", "saved_search_id");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_key_hash_key" ON "ApiKey"("key_hash");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSnapshot" ADD CONSTRAINT "JobSnapshot_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrawlLog" ADD CONSTRAINT "CrawlLog_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAlert" ADD CONSTRAINT "JobAlert_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAlert" ADD CONSTRAINT "JobAlert_saved_search_id_fkey" FOREIGN KEY ("saved_search_id") REFERENCES "SavedSearch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
