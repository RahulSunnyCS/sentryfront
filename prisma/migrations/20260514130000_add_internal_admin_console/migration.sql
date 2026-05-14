-- Phase 3.7.1 — Internal admin console: runtime feature flags + audit log + FP-rate snapshots.

-- CreateTable: FeatureFlag — runtime overrides layered on top of env-driven defaults.
CREATE TABLE "FeatureFlag" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "value" TEXT,
    "updatedBy" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable: FeatureFlagAudit — append-only audit log for flag flips and admin quota overrides.
CREATE TABLE "FeatureFlagAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "value" TEXT,
    "updatedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "FeatureFlagAudit_key_createdAt_idx" ON "FeatureFlagAudit"("key", "createdAt");

-- CreateTable: FpRateSnapshot — daily aggregated FP rates per (moduleId, confidence).
CREATE TABLE "FpRateSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "snapshotAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moduleId" TEXT NOT NULL,
    "confidence" TEXT,
    "total" INTEGER NOT NULL,
    "fpCount" INTEGER NOT NULL,
    "helpfulCount" INTEGER NOT NULL,
    "dismissedCount" INTEGER NOT NULL,
    "fixDidntHelpCount" INTEGER NOT NULL,
    "missedOtherCount" INTEGER NOT NULL,
    "fpRate" REAL NOT NULL,
    "helpfulRate" REAL NOT NULL
);

-- CreateIndex
CREATE INDEX "FpRateSnapshot_moduleId_confidence_snapshotAt_idx" ON "FpRateSnapshot"("moduleId", "confidence", "snapshotAt");

-- CreateIndex
CREATE INDEX "FpRateSnapshot_snapshotAt_idx" ON "FpRateSnapshot"("snapshotAt");
