import { useQuery, useQueryClient } from "@tanstack/react-query";
import { App as AntdApp } from "antd";
import { apiGet, apiPatch } from "@/lib/api";
import type { ExchangeRateSummaryDto } from "@/lib/types";

/**
 * Shared by the Exchange Rates and Brands pages. Both read the brand's
 * dollar-purchasable flag from the same place and write it through the same
 * endpoint, so they share this query key too — toggling on one page updates the
 * other's cache with no refetch.
 */
export const EFFECTIVE_RATES_KEY = ["exchange-rates-effective"];

/**
 * The rate in force for every brand right now, plus each brand's
 * dollar-purchasable flag.
 *
 * Two things to know before rendering from this:
 *
 * - It covers ACTIVE brands only (`ExchangeRateService` filters on
 *   `b.IsActive`), so a brand missing from the result is not "disabled" — it's
 *   unknown.
 * - It fails outright with a 404 when no platform base rate is configured,
 *   taking the dollar flags down with it. Callers should degrade to "unknown"
 *   rather than treating an error as "off".
 *
 * This is the only response DTO on the API that exposes the flag at all;
 * BrandReturnDTO does not carry it (verified against prod and test swagger,
 * 2026-09-10).
 */
export function useEffectiveRates() {
  return useQuery({
    queryKey: EFFECTIVE_RATES_KEY,
    queryFn: async () => {
      const res = await apiGet<ExchangeRateSummaryDto[]>(
        "ExchangeRate/GetAllEffectiveRates",
      );
      if (!res.status) throw new Error(res.message ?? "Failed to load rates");
      return res.data ?? [];
    },
  });
}

/**
 * Flips a brand's master switch for dollar purchasing.
 *
 * Off blocks dollar purchasing for every product under the brand regardless of
 * each product's own flag; on merely enables the brand, and products still opt
 * in individually.
 *
 * The write is optimistic because the effective-rates list is the only readable
 * source for this value — waiting on a refetch would leave the switch visibly
 * lagging the click. The previous list is restored verbatim if the PATCH fails.
 */
export function useSetBrandDollarPurchasable() {
  const queryClient = useQueryClient();
  const { message } = AntdApp.useApp();

  return async function setDollarPurchasable(
    brandId: string,
    brandName: string | null | undefined,
    value: boolean,
  ) {
    const prev =
      queryClient.getQueryData<ExchangeRateSummaryDto[]>(EFFECTIVE_RATES_KEY);
    if (prev) {
      queryClient.setQueryData<ExchangeRateSummaryDto[]>(
        EFFECTIVE_RATES_KEY,
        prev.map((r) =>
          r.brandId === brandId ? { ...r, isDollarPurchasable: value } : r,
        ),
      );
    }

    const res = await apiPatch<boolean>(
      `Brand/SetBrandDollarPurchasable/${brandId}/dollar-purchasable`,
      { isDollarPurchasable: value },
    );

    if (!res.status) {
      message.error(res.message ?? "Could not update dollar purchasing");
      queryClient.setQueryData(EFFECTIVE_RATES_KEY, prev);
      return false;
    }

    message.success(
      res.message ??
        `Dollar purchasing ${value ? "enabled" : "disabled"} for ${
          brandName ?? "this brand"
        }`,
    );
    return true;
  };
}
