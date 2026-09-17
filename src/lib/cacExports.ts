// Exports served by the admin CacRegistrationController. Each returns an error
// message on failure, or null once the browser has been handed the file.
//
// Two families, each covering all/one/selected:
//   Export*                 → a single .xlsx workbook
//   Export*WithDocuments    → a .zip of that workbook plus the registrants'
//                             uploaded passport, signature and ID files, foldered
//                             per registration and per role (Proprietor,
//                             Directors, Secretaries)
//
// The older DownloadExcelFiles/download-excel route is the ancestor of the
// WithDocuments family and is deliberately not wrapped here — it still answers
// 200 with an empty archive.
//
// NOTE: the API does not send Access-Control-Expose-Headers, so the browser
// cannot read the Content-Disposition name these endpoints set (e.g.
// "CAC_Registrations_WithDocuments_All_20260917_091340.zip"). The fallback names
// below are what users will actually see.
import { API_BASE_URL, downloadFile, downloadFilePost } from "./api";

const BASE = `${API_BASE_URL}CacRegistration`;

// An empty zip is 22 bytes — just the end-of-central-directory record. Every
// WithDocuments archive contains at least the workbook, so anything that small
// means the server produced nothing and saving it would hand the user a file
// that opens empty.
const EMPTY_ZIP_BYTES = 22;

const rejectEmptyZip = {
  validate: (blob: Blob) =>
    blob.size <= EMPTY_ZIP_BYTES
      ? "The server returned an empty archive — no documents are stored for the selected registrations."
      : null,
};

/** Every registration in the system as one workbook — takes no filters. */
export function downloadAllCacRegistrations() {
  return downloadFile(
    `${BASE}/ExportAllCacRegistrations`,
    "CAC-Registrations.xlsx",
  );
}

/** Every registration plus all uploaded documents, as a zip. */
export function downloadAllCacRegistrationsWithDocuments() {
  return downloadFile(
    `${BASE}/ExportAllCacRegistrationsWithDocuments`,
    "CAC-Registrations-WithDocuments.zip",
    rejectEmptyZip,
  );
}

/** A single registration as a workbook. */
export function downloadCacRegistration(cacId: string) {
  return downloadFile(
    `${BASE}/ExportCacRegistrationById?id=${encodeURIComponent(cacId)}`,
    "CAC-Registration.xlsx",
  );
}

/** A single registration plus its documents, as a zip. */
export function downloadCacRegistrationWithDocuments(cacId: string) {
  return downloadFile(
    `${BASE}/ExportCacRegistrationWithDocumentsById?id=${encodeURIComponent(cacId)}`,
    "CAC-Registration-WithDocuments.zip",
    rejectEmptyZip,
  );
}

/** The chosen registrations as one workbook. */
export function downloadSelectedCacRegistrations(cacIds: string[]) {
  return downloadFilePost(
    `${BASE}/ExportSelectedCacRegistrations`,
    "CAC-Registrations-Selected.xlsx",
    cacIds,
  );
}

/**
 * The chosen registrations plus their documents, as a zip.
 *
 * Ids that match no record are skipped silently — the server answers 200 with
 * whatever it did find rather than reporting the miss.
 */
export function downloadSelectedCacRegistrationsWithDocuments(cacIds: string[]) {
  return downloadFilePost(
    `${BASE}/ExportSelectedCacRegistrationsWithDocuments`,
    "CAC-Registrations-Selected-WithDocuments.zip",
    cacIds,
    rejectEmptyZip,
  );
}
