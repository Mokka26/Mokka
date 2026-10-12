-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "passwordChangedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "NewsletterSubscriber" ADD COLUMN     "confirmToken" TEXT,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "unsubscribedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "adminNote" TEXT,
ADD COLUMN     "confirmationSentAt" TIMESTAMP(3),
ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'NL',
ADD COLUMN     "fulfillmentStatus" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "gclid" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "publicToken" TEXT,
ADD COLUMN     "shippedAt" TIMESTAMP(3),
ADD COLUMN     "trackingCode" TEXT,
ADD COLUMN     "trackingUrl" TEXT;

-- CreateTable
CREATE TABLE "SlugRedirect" (
    "id" TEXT NOT NULL,
    "oldSlug" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlugRedirect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SlugRedirect_oldSlug_key" ON "SlugRedirect"("oldSlug");

-- CreateIndex
CREATE INDEX "SlugRedirect_productId_idx" ON "SlugRedirect"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsletterSubscriber_confirmToken_key" ON "NewsletterSubscriber"("confirmToken");

-- CreateIndex
CREATE UNIQUE INDEX "Order_publicToken_key" ON "Order"("publicToken");

-- CreateIndex
CREATE INDEX "Order_fulfillmentStatus_idx" ON "Order"("fulfillmentStatus");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "Order_email_idx" ON "Order"("email");

