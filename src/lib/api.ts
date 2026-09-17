import axios, {
  AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
} from "axios";
import type { ApiResult } from "./types";

export const AUTH_STORAGE_KEY =
  import.meta.env.VITE_AUTH_STORAGE_KEY ?? "SuperAppAdminReact__Authentication";

// Normalize: always expose the base URL with a trailing slash so string
// concatenation like `${API_BASE_URL}User/Download` works regardless of how
// the env var is written.
const RAW_BASE = import.meta.env.VITE_API_BASE_URL ?? "";
export const API_BASE_URL = RAW_BASE.endsWith("/") ? RAW_BASE : RAW_BASE + "/";

// Some endpoints (e.g. the Worker/sales-personnel controller) live directly
// under the host at `/api/...` rather than the versioned `/api/v1/` base.
// Expose the bare origin so those absolute URLs can be built. Falls back to the
// base URL string if it isn't a parseable absolute URL.
export const API_ORIGIN = (() => {
  try {
    return new URL(API_BASE_URL).origin;
  } catch {
    return API_BASE_URL.replace(/\/+$/, "");
  }
})();

interface StoredAuth {
  accessToken: string;
}

function readToken(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    return parsed.accessToken ?? null;
  } catch {
    return null;
  }
}

// Decode JWT payload without a crypto dependency.
function decodeJwt(token: string): { exp?: number } | null {
  try {
    const [, payload] = token.split(".");
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isTokenValid(token: string | null | undefined): boolean {
  if (!token) return false;
  const decoded = decodeJwt(token);
  if (!decoded?.exp) return false;
  return decoded.exp * 1000 > Date.now();
}

export const http = axios.create({
  baseURL: API_BASE_URL,
  headers: { Accept: "application/json" },
});

http.interceptors.request.use((config) => {
  const token = readToken();
  if (token && isTokenValid(token)) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>)["Authorization"] =
      `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      // Avoid loops: only bounce if not already on /login
      if (!window.location.pathname.toLowerCase().startsWith("/login")) {
        const returnUrl = encodeURIComponent(
          window.location.pathname + window.location.search,
        );
        window.location.assign(`/login?returnUrl=${returnUrl}`);
      }
    }
    return Promise.reject(error);
  },
);

// Mirrors HttpService.SendMessageAsync: accepts either a Result<T> envelope or a raw T
// and always returns a uniform ApiResult<T>.
function normalize<T>(payload: unknown): ApiResult<T> {
  if (
    payload &&
    typeof payload === "object" &&
    "status" in (payload as Record<string, unknown>) &&
    typeof (payload as { status: unknown }).status === "boolean"
  ) {
    return payload as ApiResult<T>;
  }
  return {
    data: (payload ?? null) as T | null,
    message: "Operation completed successfully",
    status: true,
  };
}

function fail<T>(err: unknown): ApiResult<T> {
  const axiosErr = err as AxiosError<ApiResult<T>>;
  const data = axiosErr.response?.data;
  if (data && typeof data === "object" && "status" in data) {
    return data;
  }
  return {
    data: null,
    message: axiosErr.message ?? "An error occurred",
    status: false,
  };
}

export async function apiGet<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<ApiResult<T>> {
  try {
    const res = await http.get(url, config);
    return normalize<T>(res.data);
  } catch (err) {
    return fail<T>(err);
  }
}

export async function apiPost<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<ApiResult<T>> {
  try {
    const res = await http.post(url, data, config);
    return normalize<T>(res.data);
  } catch (err) {
    return fail<T>(err);
  }
}

export async function apiPut<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<ApiResult<T>> {
  try {
    const res = await http.put(url, data, config);
    return normalize<T>(res.data);
  } catch (err) {
    return fail<T>(err);
  }
}

export async function apiPatch<T>(
  url: string,
  data?: unknown,
  config?: AxiosRequestConfig,
): Promise<ApiResult<T>> {
  try {
    const res = await http.patch(url, data, config);
    return normalize<T>(res.data);
  } catch (err) {
    return fail<T>(err);
  }
}

export async function apiDelete<T>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<ApiResult<T>> {
  try {
    const res = await http.delete(url, config);
    return normalize<T>(res.data);
  } catch (err) {
    return fail<T>(err);
  }
}

// `responseType: "blob"` applies to error responses too, so a failed download
// hands `fail()` a Blob rather than the Result envelope and every failure reads
// as "Request failed with status code 400". Read the body back as text to
// recover the server's own message (e.g. "This order has not been invoiced yet").
async function blobErrorMessage(err: unknown): Promise<string | null> {
  const data = (err as AxiosError).response?.data;
  if (!(data instanceof Blob)) return null;
  try {
    const parsed = JSON.parse(await data.text()) as { message?: unknown };
    return typeof parsed.message === "string" && parsed.message.trim()
      ? parsed.message
      : null;
  } catch {
    return null;
  }
}

// Hands the blob to the browser as a download. The Content-Disposition filename
// is only readable when the server also sends Access-Control-Expose-Headers —
// the admin API does not today, so cross-origin downloads fall back to the
// caller's filename. Keep that fallback meaningful.
function saveBlob(res: AxiosResponse, fallbackFilename: string) {
  let filename = fallbackFilename;
  const disposition = res.headers?.["content-disposition"] as string | undefined;
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^;"]+)"?/i);
  if (match?.[1]) filename = decodeURIComponent(match[1]);

  const blobUrl = URL.createObjectURL(res.data as Blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

async function downloadError(err: unknown): Promise<string> {
  return (
    (await blobErrorMessage(err)) ?? fail<never>(err).message ?? "Download failed"
  );
}

// `validate` lets a caller reject a 200 that carries nothing useful — an export
// that answers with an empty archive rather than an error, say. Returning a
// message from it skips the download and surfaces that message instead.
type DownloadConfig = AxiosRequestConfig & {
  validate?: (blob: Blob) => string | null;
};

// Authenticated file download. Unlike `window.open(...)`, this routes through the
// axios instance so the Bearer token is attached (required by endpoints like
// Order/DownloadWorkerSales that return 401 without it). Streams the response as a
// blob and triggers a browser download, honoring the server's Content-Disposition
// filename when present. Returns an error message on failure, or null on success.
export async function downloadFile(
  url: string,
  fallbackFilename: string,
  config?: DownloadConfig,
): Promise<string | null> {
  const { validate, ...axiosConfig } = config ?? {};
  try {
    const res = await http.get(url, { ...axiosConfig, responseType: "blob" });
    const rejection = validate?.(res.data as Blob);
    if (rejection) return rejection;
    saveBlob(res, fallbackFilename);
    return null;
  } catch (err) {
    return await downloadError(err);
  }
}

// Same contract as `downloadFile`, for the export endpoints that take their
// selection in a POST body — CacRegistration's ExportSelected* routes expect a
// bare JSON array of ids.
export async function downloadFilePost(
  url: string,
  fallbackFilename: string,
  body?: unknown,
  config?: DownloadConfig,
): Promise<string | null> {
  const { validate, ...axiosConfig } = config ?? {};
  try {
    const res = await http.post(url, body, {
      ...axiosConfig,
      responseType: "blob",
    });
    const rejection = validate?.(res.data as Blob);
    if (rejection) return rejection;
    saveBlob(res, fallbackFilename);
    return null;
  } catch (err) {
    return await downloadError(err);
  }
}

// Multipart helper mirroring HttpService.PostFormAsync: flattens an object into a FormData
// body (arrays become indexed fields, dates serialize to ISO). Files pass through as-is.
export function toFormData(data: Record<string, unknown>, file?: File): FormData {
  const fd = new FormData();
  if (file) fd.append("ImageFile", file, file.name);
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;
    if (value instanceof File) {
      fd.append(key, value, value.name);
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => fd.append(`${key}[${i}]`, String(item)));
    } else if (value instanceof Date) {
      fd.append(key.toLowerCase(), value.toISOString());
    } else {
      fd.append(key.toLowerCase(), String(value));
    }
  }
  return fd;
}
