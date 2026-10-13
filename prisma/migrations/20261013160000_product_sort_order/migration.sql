-- Handmatige productvolgorde per categorie (admin → Categorieën).
-- null = geen handmatige positie; laag nummer = eerst op de categoriepagina.
ALTER TABLE "Product" ADD COLUMN "sortOrder" INTEGER;

CREATE INDEX "Product_category_sortOrder_idx" ON "Product"("category", "sortOrder");
