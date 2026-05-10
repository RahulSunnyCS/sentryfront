-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DomainVerification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'dns_txt',
    "token" TEXT NOT NULL,
    "verifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DomainVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DomainVerification" ("createdAt", "domain", "id", "method", "token", "userId", "verifiedAt") SELECT "createdAt", "domain", "id", "method", "token", "userId", "verifiedAt" FROM "DomainVerification";
DROP TABLE "DomainVerification";
ALTER TABLE "new_DomainVerification" RENAME TO "DomainVerification";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
