import { useQuery } from "@tanstack/react-query";
import { getStorefrontShippingOptions } from "@/lib/storefrontApi";

/**
 * Shared by the Storefront Shipping page and the Record Storefront Order modal.
 * Both read the same shipping options (regions, payment modes, base weight) and
 * quote through the same endpoint, so they share this query key too — the modal
 * and the page stay in sync with no duplicate fetch.
 */
export const STOREFRONT_SHIPPING_OPTIONS_KEY = [
  "storefront",
  "shipping-options",
];

export function useStorefrontShippingOptions(enabled = true) {
  return useQuery({
    queryKey: STOREFRONT_SHIPPING_OPTIONS_KEY,
    queryFn: async () => {
      const res = await getStorefrontShippingOptions();
      if (!res.status) throw new Error(res.message ?? "Failed to load shipping options");
      return res.data ?? null;
    },
    staleTime: 5 * 60_000,
    enabled,
  });
}
