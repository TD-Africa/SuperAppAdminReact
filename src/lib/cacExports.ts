// Exports served by the admin CacRegistrationController. Each returns an error
// message on failure, or null once the browser has been handed the file.
//
// NOTE: the API does not send Access-Control-Expose-Headers, so the browser
// cannot read the Content-Disposition name these endpoints set (e.g.
// "CAC_Registrations_1242abfb_20260916_144335.xlsx"). The fallback names below
// are what users will actually see.
import { API_BASE_URL, downloadFile, downloadFilePost } from "./api";

const BASE = `${API_BASE_URL}CacRegistration`;

/** Every registration in the system as one workbook — takes no filters. */
export function downloadAllCacRegistrations() {
  return downloadFile(
    `${BASE}/ExportAllCacRegistrations`,
    "CAC-Registrations.xlsx",
  );
}

/** A single registration as a workbook. */
export function downloadCacRegistration(cacId: string) {
  return downloadFile(
    `${BASE}/ExportCacRegistrationById?id=${encodeURIComponent(cacId)}`,
    "CAC-Registration.xlsx",
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
 * Workbook plus the registrants' uploaded documents (passports, signatures, IDs)
 * as a zip.
 *
 * Heads up: on the test API this currently comes back as a valid but empty
 * archive — 200, application/zip, zero entries — because the document-fetch step
 * finds no files. An empty zip is 22 bytes (just the end-of-central-directory
 * record), so it is caught here and reported instead of silently saving a file
 * that opens empty.
 */
const EMPTY_ZIP_BYTES = 22;

export function downloadCacDocuments(cacIds: string[]) {
  return downloadFilePost(
    `${BASE}/DownloadExcelFiles/download-excel`,
    "CAC-Documents.zip",
    cacIds,
    {
      validate: (blob) =>
        blob.size <= EMPTY_ZIP_BYTES
          ? "The server returned an empty archive — no documents are stored for the selected registrations."
          : null,
    },
  );
}
