// Shared rules for POST /api/VirtualAccount/provision, used by both the
// single-customer panel in the edit modal and the bulk sweep on the Wallets page.
import { API_ORIGIN } from "./api";

// VirtualAccountController sits at `api/[controller]`, outside the versioned
// `/api/v1/` base the rest of the admin API uses.
export const PROVISION_VA_URL = `${API_ORIGIN}/api/VirtualAccount/provision`;

// The server pauses 400ms between users to stay under Paystack's rate limit, so
// a large selection has to be split across requests or it outlives the gateway
// timeout. 20 keeps a batch well under a minute even when every user is new.
export const PROVISION_BATCH_SIZE = 20;

/** The customer fields Paystack needs before it will assign a dedicated account. */
export interface VaFields {
  email?: string | null;
  phoneNumber?: string | null;
  firstName?: string | null;
  companyName?: string | null;
}

// Mirrors WalletService.CreateVirtualAccountAsync's own guards, so an admin can
// see what to fix before spending a round trip. Paystack's customer endpoint
// keys on email, and the service falls back to CompanyName when FirstName is
// blank (LastName falls back to "TD-SP", so it is never a blocker).
export function vaBlockers(user: VaFields): string[] {
  const blockers: string[] = [];
  if (!user.phoneNumber?.trim()) blockers.push("Phone number");
  if (!user.email?.trim()) blockers.push("Email");
  if (!user.firstName?.trim() && !user.companyName?.trim())
    blockers.push("First name or Company name");
  return blockers;
}

/** Turns a provisioning failure message into the next action for the admin. */
export function provisionHint(message: string): string | null {
  const m = message.toLowerCase();
  if (m.includes("no phone number"))
    return "Add a phone number, save, then retry.";
  if (m.includes("firstname/lastname") || m.includes("companyname"))
    return "Set a first name or a company name, save, then retry.";
  if (m.includes("customer resolve failed"))
    return "Paystack rejected the customer details — check the email is valid and not already used by another Paystack customer, then retry.";
  if (m.includes("update paystack customer identity"))
    return "Paystack has the customer but refused the name/phone update — check the phone number format (e.g. 08012345678), then retry.";
  if (m.includes("pending dedicated account"))
    return "Paystack is still creating the account. Retry in a minute — no changes needed.";
  if (m.includes("dedicated account creation failed"))
    return "Paystack refused to assign a dedicated account. Confirm the Paystack business is enabled for dedicated accounts, then retry.";
  if (m.includes("user not found"))
    return "This account is deleted, so it cannot be provisioned.";
  return null;
}
