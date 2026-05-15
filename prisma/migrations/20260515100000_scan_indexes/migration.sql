-- CreateIndex
CREATE INDEX "Scan_userId_startedAt_id_idx" ON "Scan"("userId", "startedAt" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "Scan_userId_grade_idx" ON "Scan"("userId", "grade");
