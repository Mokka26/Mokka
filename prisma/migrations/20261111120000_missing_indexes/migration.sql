-- Ontbrekende indexen (verbeterplan nov 2026, ARCH-8). Alleen indexen, geen datawijziging.
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX "Order_molliePaymentId_idx" ON "Order"("molliePaymentId");
CREATE INDEX "RateLimit_resetAt_idx" ON "RateLimit"("resetAt");
CREATE INDEX "Product_category_hidden_deletedAt_sortOrder_idx" ON "Product"("category", "hidden", "deletedAt", "sortOrder");
