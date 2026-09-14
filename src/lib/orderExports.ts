// File downloads served by the admin OrderController. Both are guarded
// server-side by CanViewOrders, the same permission that opens the Orders page.
import { API_BASE_URL, downloadFile } from "./api";

/**
 * The customer invoice for one order, as a PDF.
 *
 * Routed through `downloadFile` rather than a link: the endpoint is
 * token-authenticated and answers 401 to a bare `window.open`. The server names
 * the file after the invoice number (e.g. TDNGCI-167081.pdf) in
 * Content-Disposition, so the fallback below is only reached if that header is
 * stripped in transit.
 *
 * Fails with "This order has not been invoiced yet" when no line has an invoice
 * number — check `hasInvoice(order)` before offering the download.
 *
 * Caveat: renders ONE document per order. A multi-warehouse order now carries
 * several invoice numbers and the API collapses them into a single PDF; there
 * is no per-invoice parameter yet.
 */
export function downloadOrderInvoice(orderId: string) {
  return downloadFile(
    `${API_BASE_URL}Order/DownloadInvoice/${encodeURIComponent(orderId)}`,
    `Invoice-${orderId}.pdf`,
  );
}
