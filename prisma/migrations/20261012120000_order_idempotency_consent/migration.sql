-- AlterTable
ALTER TABLE "NewsletterSubscriber" ADD COLUMN     "confirmTokenAt" TIMESTAMP(3);
-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "analyticsConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "idempotencyKey" TEXT;
-- CreateIndex
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");
-- CreateIndex
CREATE INDEX "Order_archivedAt_idx" ON "Order"("archivedAt");
