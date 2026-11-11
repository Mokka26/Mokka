-- Bezorgvragen uit de checkout + montagewens (verbeterplan nov 2026, UX-5/MKT-9).
ALTER TABLE "Order" ADD COLUMN "deliveryFloor" TEXT;
ALTER TABLE "Order" ADD COLUMN "deliveryElevator" BOOLEAN;
ALTER TABLE "Order" ADD COLUMN "deliveryNotes" TEXT;
ALTER TABLE "Order" ADD COLUMN "assemblyRequested" BOOLEAN NOT NULL DEFAULT false;
