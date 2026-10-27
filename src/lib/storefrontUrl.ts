import { API_BASE_URL } from "./api";

const PROD_STOREFRONT_URL = "https://storefronts.tdafrica.com/";
const DEV_STOREFRONT_URL = "https://storefronts.novotechafrica.com/";

// `vite build` reports MODE=production for every deployed environment, so the
// API host is the only signal that separates production from test builds.
const isProductionApi = /\/\/tdadminapi\.azurewebsites\.net/i.test(API_BASE_URL);

export const STOREFRONT_PUBLIC_URL = isProductionApi ? PROD_STOREFRONT_URL : DEV_STOREFRONT_URL;

export function storefrontSlug(companyName: string | null | undefined): string | null {
  const slug = companyName?.trim().toLowerCase().replace(/\s+/g, "-");
  return slug || null;
}

export function storefrontUrlFor(companyName: string | null | undefined): string | null {
  const slug = storefrontSlug(companyName);
  return slug ? `${STOREFRONT_PUBLIC_URL}${encodeURIComponent(slug)}` : null;
}
