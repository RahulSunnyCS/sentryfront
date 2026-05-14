-- AlterTable: add confidence column to Finding (nullable; populated by 3.11 tunable modules)
ALTER TABLE "Finding" ADD COLUMN "confidence" TEXT;

-- CreateTable: append-only user verdicts on findings.
-- Multiple rows per (scanId, findingId, userId) allowed; aggregator picks latest.
CREATE TABLE "FindingDisposition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scanId" TEXT NOT NULL,
    "findingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "disposition" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FindingDisposition_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "Scan" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FindingDisposition_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FindingDisposition_scanId_findingId_userId_idx" ON "FindingDisposition"("scanId", "findingId", "userId");

-- CreateIndex
CREATE INDEX "FindingDisposition_findingId_idx" ON "FindingDisposition"("findingId");

-- CreateIndex
CREATE INDEX "FindingDisposition_createdAt_idx" ON "FindingDisposition"("createdAt");
