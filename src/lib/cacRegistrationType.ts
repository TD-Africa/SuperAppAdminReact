import type { CacRegistrationResponse } from "@/lib/types";

/**
 * CAC registrations come from two separate onboarding flows in the customer web
 * app, and the shape of the people attached to a record depends on which one ran:
 *
 *  - Limited Liability Company — StartCacRegistration. Stamps
 *    BusinessDescription = "Limited Liability Company" and collects share
 *    capital, shareholding ratio, directors and secretaries.
 *  - Business Name — StartCacRegistrationBusinessName. Collects a single
 *    proprietor. It never sets BusinessDescription, so that column is null for
 *    every business-name record.
 *
 * (See StartCacRegistrationDTO / StartCacRegistrationBusinessNameDTO in the .NET
 * API and Signup.jsx in superappweb.)
 *
 * The API now states the flow outright in `registrationType` ("Company" /
 * "BusinessName"), so that is read first. The older marker-sniffing below is
 * kept only as a fallback for records that predate the field.
 */
export type CacRegistrationType = "llc" | "businessName";

const LLC_PATTERN = /\bllc\b|limited liability/i;
const BUSINESS_NAME_PATTERN = /business\s*(name|owner)|proprietor|sole/i;

type TypeSource = Pick<
  CacRegistrationResponse,
  "registrationType" | "businessDescription" | "proprietor" | "directors" | "secretaries"
>;

/**
 * Which flow produced a record. `registrationType` is authoritative when
 * present; otherwise the markers are checked most-explicit first, and because
 * only the LLC flow writes a marker at all, a record carrying none is a
 * business name.
 */
export function cacRegistrationType(reg: TypeSource): CacRegistrationType {
  const declared = reg.registrationType?.trim().toLowerCase();
  if (declared === "company") return "llc";
  if (declared === "businessname") return "businessName";

  const marker = reg.businessDescription;
  if (marker) {
    if (LLC_PATTERN.test(marker)) return "llc";
    if (BUSINESS_NAME_PATTERN.test(marker)) return "businessName";
  }
  if (reg.proprietor) return "businessName";
  if (reg.directors?.length || reg.secretaries?.length) return "llc";
  return "businessName";
}

export const CAC_TYPE_LABEL: Record<CacRegistrationType, string> = {
  llc: "Limited Liability Company",
  businessName: "Business Name",
};

/** Short form for table cells, where the full LLC label is too wide. */
export const CAC_TYPE_SHORT_LABEL: Record<CacRegistrationType, string> = {
  llc: "LLC",
  businessName: "Business Name",
};

export const CAC_TYPE_COLOR: Record<CacRegistrationType, string> = {
  llc: "geekblue",
  businessName: "purple",
};
