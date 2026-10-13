/**
 * Kleine fabrieken voor test-fixtures. Elke fabriek geeft een compleet,
 * geldig object terug; overschrijf alleen wat de test nodig heeft.
 */

/** Spiegel van het Prisma-model `Product` (zonder relaties). */
export type DbProduct = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  listPrice: number | null;
  category: string;
  images: string;
  specs: string | null;
  sizeVariants: string | null;
  nachtkastMode: string | null;
  nachtkastPrice: number | null;
  nachtkastPrice2: number | null;
  voetbankMode: string | null;
  voetbankPrice: number | null;
  featured: boolean;
  stock: number;
  deliveryTime: string | null;
  colorGroup: string | null;
  colorName: string | null;
  colorHex: string | null;
  source: string | null;
  hidden: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export const IMAGE_URL = "https://res.cloudinary.com/mokka/image/upload/v1/test/bed-oslo.jpg";

export function makeProduct(overrides: Partial<DbProduct> = {}): DbProduct {
  return {
    id: "prod_1",
    slug: "bed-oslo",
    name: "Bed Oslo",
    description: "Een rustig bed van massief eikenhout met een laag hoofdbord.",
    price: 599,
    listPrice: null,
    category: "bedden",
    images: JSON.stringify([{ url: IMAGE_URL, w: 1600, h: 1200 }]),
    specs: null,
    sizeVariants: null,
    nachtkastMode: null,
    nachtkastPrice: null,
    nachtkastPrice2: null,
    voetbankMode: null,
    voetbankPrice: null,
    featured: false,
    stock: 10,
    deliveryTime: "2-3 werkdagen",
    colorGroup: null,
    colorName: null,
    colorHex: null,
    source: null,
    hidden: false,
    deletedAt: null,
    createdAt: new Date("2026-01-15T10:00:00Z"),
    updatedAt: new Date("2026-01-15T10:00:00Z"),
    ...overrides,
  };
}

/** Maatvarianten zoals de admin ze opslaat (JSON-string). */
export function sizeVariantsJson(variants: Array<{ label: string; price: number; listPrice?: number }>): string {
  return JSON.stringify(variants);
}

export type DbOrderItem = {
  id: string;
  orderId: string;
  productId: string;
  productName: string;
  variantLabel: string | null;
  quantity: number;
  price: number;
};

export function makeOrderItem(overrides: Partial<DbOrderItem> = {}): DbOrderItem {
  return {
    id: "item_1",
    orderId: "order_1",
    productId: "prod_1",
    productName: "Bed Oslo",
    variantLabel: null,
    quantity: 1,
    price: 599,
    ...overrides,
  };
}

/** Spiegel van het Prisma-model `Order`, inclusief `items`. */
export type DbOrder = {
  id: string;
  orderNumber: string;
  total: number;
  shipping: number;
  status: string;
  molliePaymentId: string | null;
  paymentMethod: string | null;
  paidAt: Date | null;
  publicToken: string | null;
  confirmationSentAt: Date | null;
  fulfillmentStatus: string;
  trackingCode: string | null;
  trackingUrl: string | null;
  shippedAt: Date | null;
  adminNote: string | null;
  gclid: string | null;
  idempotencyKey: string | null;
  analyticsConsent: boolean;
  archivedAt: Date | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  houseNumber: string;
  city: string;
  zipCode: string;
  country: string;
  createdAt: Date;
  updatedAt: Date;
  items: DbOrderItem[];
};

export function makeOrder(overrides: Partial<DbOrder> = {}): DbOrder {
  return {
    id: "order_1",
    orderNumber: "MOK-261012-ABCDE",
    total: 599,
    shipping: 0,
    status: "open",
    molliePaymentId: "tr_test123",
    paymentMethod: null,
    paidAt: null,
    publicToken: "0123456789abcdef0123456789abcdef",
    confirmationSentAt: null,
    fulfillmentStatus: "pending",
    trackingCode: null,
    trackingUrl: null,
    shippedAt: null,
    adminNote: null,
    gclid: null,
    idempotencyKey: null,
    analyticsConsent: false,
    archivedAt: null,
    firstName: "Jan",
    lastName: "Jansen",
    email: "jan@example.com",
    phone: "0612345678",
    address: "Dorpsstraat",
    houseNumber: "1",
    city: "Utrecht",
    zipCode: "3511 AB",
    country: "NL",
    createdAt: new Date("2026-10-12T09:00:00Z"),
    updatedAt: new Date("2026-10-12T09:00:00Z"),
    items: [makeOrderItem()],
    ...overrides,
  };
}

/** Geldige klantgegevens voor createCheckout. */
export function makeCustomer(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    firstName: "Jan",
    lastName: "Jansen",
    email: "jan@example.com",
    phone: "0612345678",
    address: "Dorpsstraat",
    houseNumber: "1",
    city: "Utrecht",
    zipCode: "3511 AB",
    country: "NL",
    ...overrides,
  };
}
