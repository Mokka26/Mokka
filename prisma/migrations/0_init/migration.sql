◇ injected env (11) from .env.local // tip: ⌘ enable debugging { debug: true }
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContactMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "subject" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeletedImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "productSlug" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "w" INTEGER,
    "h" INTEGER,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."NewsletterSubscriber" (
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsletterSubscriber_pkey" PRIMARY KEY ("email")
);

-- CreateTable
CREATE TABLE "public"."Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL,
    "houseNumber" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "molliePaymentId" TEXT,
    "shipping" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "productName" TEXT NOT NULL DEFAULT '',
    "variantLabel" TEXT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Product" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "images" TEXT NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "specs" TEXT,
    "colorGroup" TEXT,
    "colorHex" TEXT,
    "colorName" TEXT,
    "deliveryTime" TEXT,
    "stock" INTEGER NOT NULL DEFAULT 10,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "source" TEXT,
    "sizeVariants" TEXT,
    "listPrice" DOUBLE PRECISION,
    "nachtkastPrice" DOUBLE PRECISION,
    "nachtkastMode" TEXT,
    "nachtkastPrice2" DOUBLE PRECISION,
    "voetbankMode" TEXT,
    "voetbankPrice" DOUBLE PRECISION,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "public"."AdminUser"("email" ASC);

-- CreateIndex
CREATE INDEX "ContactMessage_createdAt_idx" ON "public"."ContactMessage"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "DeletedImage_deletedAt_idx" ON "public"."DeletedImage"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "DeletedImage_productId_idx" ON "public"."DeletedImage"("productId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "public"."Order"("orderNumber" ASC);

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "public"."Order"("status" ASC);

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "public"."Product"("category" ASC);

-- CreateIndex
CREATE INDEX "Product_colorGroup_idx" ON "public"."Product"("colorGroup" ASC);

-- CreateIndex
CREATE INDEX "Product_deletedAt_idx" ON "public"."Product"("deletedAt" ASC);

-- CreateIndex
CREATE INDEX "Product_hidden_idx" ON "public"."Product"("hidden" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "public"."Product"("slug" ASC);

-- CreateIndex
CREATE INDEX "Product_source_idx" ON "public"."Product"("source" ASC);

-- AddForeignKey
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

