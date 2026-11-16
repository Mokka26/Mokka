-- Extra 1-zitsbank bij bankstellen (0/1 tegen zitbankPrice). Zie schema.prisma.
ALTER TABLE "Product" ADD COLUMN "zitbankMode" TEXT;
ALTER TABLE "Product" ADD COLUMN "zitbankPrice" DOUBLE PRECISION;
