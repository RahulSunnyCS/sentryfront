-- AddForeignKey
ALTER TABLE "DomainVerification" ADD CONSTRAINT "DomainVerification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
