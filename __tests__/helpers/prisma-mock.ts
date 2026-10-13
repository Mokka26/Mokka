/**
 * Getypte Prisma-mock voor unit-tests. Alleen de modellen/methodes die de
 * geteste modules gebruiken; voeg toe wat je nodig hebt.
 *
 * Gebruik in een testbestand (jest.mock wordt door SWC gehoist):
 *
 *   jest.mock("@/lib/prisma", () => ({
 *     prisma: jest
 *       .requireActual<typeof import("@/__tests__/helpers/prisma-mock")>("@/__tests__/helpers/prisma-mock")
 *       .createPrismaMock(),
 *   }));
 *   import { prisma } from "@/lib/prisma";
 *   const db = asPrismaMock(prisma);
 */
export type PrismaMock = {
  product: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
    count: jest.Mock;
  };
  order: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    delete: jest.Mock;
  };
  orderItem: { count: jest.Mock };
  deletedImage: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock; delete: jest.Mock; deleteMany: jest.Mock };
  slugRedirect: { findUnique: jest.Mock; upsert: jest.Mock; deleteMany: jest.Mock };
  rateLimit: { findUnique: jest.Mock; deleteMany: jest.Mock };
  newsletterSubscriber: { findUnique: jest.Mock; upsert: jest.Mock; updateMany: jest.Mock; deleteMany: jest.Mock };
  contactMessage: { create: jest.Mock };
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
};

/** De `tx`-client die `prisma.$transaction(async (tx) => …)` ontvangt. */
export type TxMock = {
  order: { updateMany: jest.Mock };
  product: { update: jest.Mock; updateMany: jest.Mock };
  slugRedirect: { upsert: jest.Mock; deleteMany: jest.Mock };
};

export function createPrismaMock(): PrismaMock {
  return {
    product: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
    },
    orderItem: { count: jest.fn() },
    deletedImage: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
    slugRedirect: { findUnique: jest.fn(), upsert: jest.fn(), deleteMany: jest.fn() },
    rateLimit: { findUnique: jest.fn(), deleteMany: jest.fn() },
    newsletterSubscriber: { findUnique: jest.fn(), upsert: jest.fn(), updateMany: jest.fn(), deleteMany: jest.fn() },
    contactMessage: { create: jest.fn() },
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
  };
}

export function createTxMock(): TxMock {
  return {
    order: { updateMany: jest.fn() },
    product: { update: jest.fn(), updateMany: jest.fn() },
    slugRedirect: { upsert: jest.fn(), deleteMany: jest.fn() },
  };
}

/** Laat `$transaction(cb)` de callback met de tx-mock uitvoeren. */
export function useTransaction(db: PrismaMock, tx: TxMock): void {
  db.$transaction.mockImplementation(async (cb: (t: TxMock) => Promise<unknown>) => cb(tx));
}

/** De gemockte module heeft het type van de echte client; cast één keer. */
export function asPrismaMock(client: unknown): PrismaMock {
  return client as PrismaMock;
}
