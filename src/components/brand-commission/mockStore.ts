// MOCK — replace this module with API calls when the commission endpoints are ready.

export type CommissionSource = "inherited" | "override" | "unset";

export interface CommissionBrand {
  id: string;
  name: string;
  commissionRate: number | null;
  isInheritable: boolean;
  dynamicsId: string;
  isActive: boolean;
  updatedAt: string;
  updatedBy: string;
}

export type FranchiseBrandRow = CommissionBrand & {
  productCount: number;
  overrideCount: number;
};

export interface CommissionProduct {
  id: string;
  brandId: string;
  name: string;
  sku: string;
  basePrice: number;
  priceInDollar: number;
  quantity: number;
  dynamicsId: string;
  isVisible: boolean;
  isActive: boolean;
  isFeatured: boolean;
  commissionOverride: number | null;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  description: string;
}

let brands: CommissionBrand[] = [
  { id: "samsung", name: "Samsung", commissionRate: 8, isInheritable: true, dynamicsId: "DYN-BRAND-SAM", isActive: true, updatedAt: "2026-08-17T14:20:00Z", updatedBy: "Ada Okafor" },
  { id: "apple", name: "Apple", commissionRate: 10, isInheritable: true, dynamicsId: "DYN-BRAND-APL", isActive: true, updatedAt: "2026-08-16T09:45:00Z", updatedBy: "Kemi Adeyemi" },
  { id: "hp", name: "HP", commissionRate: null, isInheritable: false, dynamicsId: "DYN-BRAND-HP", isActive: true, updatedAt: "2026-08-12T11:00:00Z", updatedBy: "System migration" },
  { id: "lenovo", name: "Lenovo", commissionRate: 6.5, isInheritable: false, dynamicsId: "DYN-BRAND-LEN", isActive: false, updatedAt: "2026-08-15T16:10:00Z", updatedBy: "Ada Okafor" },
];

let products: CommissionProduct[] = [
  { id: "sam-1", brandId: "samsung", name: "Galaxy S25 Ultra", sku: "SAM-S25U-256", basePrice: 1850000, priceInDollar: 1200, quantity: 42, dynamicsId: "DYN-SAM-001", isVisible: true, isActive: true, isFeatured: true, commissionOverride: null },
  { id: "sam-2", brandId: "samsung", name: "Galaxy Tab S10", sku: "SAM-TABS10", basePrice: 780000, priceInDollar: 520, quantity: 18, dynamicsId: "DYN-SAM-002", isVisible: true, isActive: true, isFeatured: false, commissionOverride: 10 },
  { id: "sam-3", brandId: "samsung", name: "Galaxy Buds 3 Pro", sku: "SAM-BUDS3P", basePrice: 245000, priceInDollar: 165, quantity: 120, dynamicsId: "DYN-SAM-003", isVisible: true, isActive: true, isFeatured: false, commissionOverride: null },
  { id: "sam-4", brandId: "samsung", name: "65” Crystal UHD TV", sku: "SAM-TV65CU", basePrice: 960000, priceInDollar: 640, quantity: 9, dynamicsId: "DYN-SAM-004", isVisible: true, isActive: true, isFeatured: true, commissionOverride: 7.5 },
  { id: "apple-1", brandId: "apple", name: "iPhone 16 Pro", sku: "APL-IP16P", basePrice: 1750000, priceInDollar: 1150, quantity: 27, dynamicsId: "DYN-APL-001", isVisible: true, isActive: true, isFeatured: true, commissionOverride: null },
  { id: "apple-2", brandId: "apple", name: "MacBook Air M4", sku: "APL-MBA-M4", basePrice: 2100000, priceInDollar: 1399, quantity: 11, dynamicsId: "DYN-APL-002", isVisible: true, isActive: true, isFeatured: false, commissionOverride: 12.5 },
  { id: "hp-1", brandId: "hp", name: "EliteBook 840 G11", sku: "HP-EB840G11", basePrice: 1550000, priceInDollar: 1050, quantity: 14, dynamicsId: "DYN-HP-001", isVisible: true, isActive: true, isFeatured: false, commissionOverride: null },
  { id: "hp-2", brandId: "hp", name: "LaserJet Pro 4003", sku: "HP-LJ4003", basePrice: 520000, priceInDollar: 349, quantity: 33, dynamicsId: "DYN-HP-002", isVisible: true, isActive: true, isFeatured: false, commissionOverride: 5 },
  { id: "len-1", brandId: "lenovo", name: "ThinkPad E14 Gen 6", sku: "LEN-E14G6", basePrice: 1250000, priceInDollar: 849, quantity: 20, dynamicsId: "DYN-LEN-001", isVisible: true, isActive: false, isFeatured: false, commissionOverride: null },
];

let auditEntries: AuditEntry[] = [
  { id: "audit-1", timestamp: "2026-08-17T14:20:00Z", actor: "Ada Okafor", description: "Changed Samsung brand commission from 7.5% to 8%." },
  { id: "audit-2", timestamp: "2026-08-16T09:45:00Z", actor: "Kemi Adeyemi", description: "Enabled inheritance for Apple at 10%." },
  { id: "audit-3", timestamp: "2026-08-15T16:10:00Z", actor: "Ada Okafor", description: "Disabled inheritance for Lenovo." },
];

export interface FranchiseOrderLine {
  productId: string;
  productName: string;
  quantity: number;
  productPrice: number;
  markupPercent: number;
  storefrontUnitPrice: number;
  lineTotal: number;
}

export interface FranchiseOrder {
  id: string;
  orderNumber: string;
  founderName: string;
  tdCustomerName: string;
  status: "Pending" | "Completed" | "Cancelled";
  dateCreated: string;
  lines: FranchiseOrderLine[];
}

function snapshotLine(productId: string, quantity: number): FranchiseOrderLine | null {
  const product = products.find((item) => item.id === productId);
  const brand = brands.find((item) => item.id === product?.brandId);
  if (!product || !brand) return null;
  const { rate } = resolveCommission(product, brand);
  if (rate === null) return null;
  const unit = storefrontPrice(product.basePrice, rate)!;
  return {
    productId: product.id,
    productName: product.name,
    quantity,
    productPrice: product.basePrice,
    markupPercent: rate,
    storefrontUnitPrice: unit,
    lineTotal: unit * quantity,
  };
}

let franchiseOrders: FranchiseOrder[] = [
  {
    id: "ord-1",
    orderNumber: "FF-10041",
    founderName: "Lagos Tech Franchise",
    tdCustomerName: "Bright Retail Ltd",
    status: "Completed",
    dateCreated: "2026-08-14T10:15:00Z",
    lines: [snapshotLine("sam-1", 2)!, snapshotLine("sam-3", 5)!].filter(Boolean),
  },
  {
    id: "ord-2",
    orderNumber: "FF-10042",
    founderName: "Abuja Devices Hub",
    tdCustomerName: "Northern Gadgets",
    status: "Pending",
    dateCreated: "2026-08-16T13:40:00Z",
    lines: [snapshotLine("apple-1", 1)!, snapshotLine("apple-2", 1)!].filter(Boolean),
  },
  {
    id: "ord-3",
    orderNumber: "FF-10043",
    founderName: "Lagos Tech Franchise",
    tdCustomerName: "Office Pro Supplies",
    status: "Completed",
    dateCreated: "2026-08-17T09:05:00Z",
    lines: [snapshotLine("hp-2", 3)!, snapshotLine("sam-2", 1)!].filter(Boolean),
  },
];

export type FranchiseCatalogRow = CommissionProduct & {
  brandName: string;
  markupPercent: number | null;
  source: CommissionSource;
  storefront: number | null;
};

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const wait = <T>(value: T) => new Promise<T>((resolve) => window.setTimeout(() => resolve(value), 350));

export function resolveCommission(product: CommissionProduct, brand: CommissionBrand) {
  if (product.commissionOverride !== null) {
    return { rate: product.commissionOverride, source: "override" as const };
  }
  if (brand.isInheritable && brand.commissionRate !== null) {
    return { rate: brand.commissionRate, source: "inherited" as const };
  }
  return { rate: null, source: "unset" as const };
}

/** Storefront price = base product price + commission %. */
export function storefrontPrice(basePrice: number, commissionRate: number | null) {
  if (commissionRate === null) return null;
  return basePrice * (1 + commissionRate / 100);
}

/** Derive markup % from an edited storefront price. */
export function markupFromStorefront(basePrice: number, storefront: number) {
  if (basePrice <= 0) return null;
  return ((storefront / basePrice) - 1) * 100;
}

export function formatNaira(amount: number) {
  return `₦${Math.round(amount).toLocaleString()}`;
}

export const commissionMockStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getBrands: () => wait([...brands]),
  getBrand: (id: string) => wait(brands.find((brand) => brand.id === id) ?? null),
  getBrandSummaries: (): Promise<FranchiseBrandRow[]> => {
    const rows: FranchiseBrandRow[] = brands.map((brand) => ({
      ...brand,
      productCount: products.filter((product) => product.brandId === brand.id).length,
      overrideCount: products.filter((product) => product.brandId === brand.id && product.commissionOverride !== null).length,
    }));
    return wait(rows);
  },
  getProducts: (brandId: string) => wait(products.filter((product) => product.brandId === brandId)),
  getCatalog: (): Promise<FranchiseCatalogRow[]> => {
    const rows: FranchiseCatalogRow[] = products.map((product) => {
      const brand = brands.find((item) => item.id === product.brandId)!;
      const resolved = resolveCommission(product, brand);
      return {
        ...product,
        brandName: brand.name,
        markupPercent: resolved.rate,
        source: resolved.source,
        storefront: storefrontPrice(product.basePrice, resolved.rate),
      };
    });
    return wait(rows);
  },
  getOrders: () => wait([...franchiseOrders]),
  getOrder: (id: string) => wait(franchiseOrders.find((order) => order.id === id) ?? null),
  getAudit: (brandId: string) => wait(auditEntries.filter((entry) => entry.description.includes(brands.find((brand) => brand.id === brandId)?.name ?? ""))),
  getImpact: (brandId: string) => {
    const brandProducts = products.filter((product) => product.brandId === brandId);
    return wait({
      affectedCount: brandProducts.filter((product) => product.commissionOverride === null).length,
      overrideCount: brandProducts.filter((product) => product.commissionOverride !== null).length,
    });
  },
  getOverrideCount: (brandId: string) => products.filter((product) => product.brandId === brandId && product.commissionOverride !== null).length,
  async saveBrand(id: string, commissionRate: number | null, isInheritable: boolean) {
    const previous = brands.find((brand) => brand.id === id);
    brands = brands.map((brand) => brand.id === id
      ? { ...brand, commissionRate, isInheritable, updatedAt: new Date().toISOString(), updatedBy: "Current admin" }
      : brand);
    auditEntries = [{
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      actor: "Current admin",
      description: `Updated ${previous?.name ?? "brand"} commission from ${previous?.commissionRate ?? "not set"}% to ${commissionRate ?? "not set"}${isInheritable ? " and enabled inheritance" : " and disabled inheritance"}.`,
    }, ...auditEntries];
    notify();
    return wait(undefined);
  },
  async saveProductOverride(productId: string, commissionOverride: number | null) {
    const product = products.find((item) => item.id === productId);
    products = products.map((item) => item.id === productId ? { ...item, commissionOverride } : item);
    const brand = brands.find((item) => item.id === product?.brandId);
    const storefront = product && commissionOverride !== null
      ? storefrontPrice(product.basePrice, commissionOverride)
      : null;
    auditEntries = [{
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      actor: "Current admin",
      description: commissionOverride === null
        ? `Removed storefront override for ${product?.name ?? "product"} (${brand?.name ?? "brand"}); reverted to brand rate.`
        : `Set storefront price for ${product?.name ?? "product"} to ${storefront !== null ? formatNaira(storefront) : "—"} (markup ${commissionOverride.toFixed(2)}%, ${brand?.name ?? "brand"}).`,
    }, ...auditEntries];
    notify();
    return wait(undefined);
  },
};
