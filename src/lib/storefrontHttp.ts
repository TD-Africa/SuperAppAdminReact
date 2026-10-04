import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { AUTH_STORAGE_KEY, isTokenValid } from "./api";
import type { ApiResult } from "./types";

type FailoverRequestConfig = AxiosRequestConfig & { __failoverTried?: boolean };

function normalizeBase(url: string): string {
  return url.endsWith("/") ? url : `${url}/`;
}

const STOREFRONT_BASE_URLS = [
  import.meta.env.VITE_API_BASE_URL,
  import.meta.env.VITE_API_FALLBACK_BASE_URL,
]
  .filter((url): url is string => Boolean(url))
  .map(normalizeBase)
  .filter((url, index, urls) => urls.indexOf(url) === index);

let activeBaseIndex = 0;

function readToken(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { accessToken?: string };
    return parsed.accessToken ?? null;
  } catch {
    return null;
  }
}

function isFailoverError(error: AxiosError): boolean {
  if (!error.response) return true;
  const status = error.response.status;
  // 404: storefront routes may only exist on the fallback host.
  return status === 404 || status === 502 || status === 503 || status === 504;
}

const storefrontHttp = axios.create({
  baseURL: STOREFRONT_BASE_URLS[0] ?? "",
  headers: { Accept: "application/json" },
});

storefrontHttp.interceptors.request.use((config) => {
  const token = readToken();
  if (token && isTokenValid(token)) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }
  return config;
});

storefrontHttp.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    // Do not global-logout on 401 here — wallet/earnings endpoints may return
    // resource-level 401s while the admin session is still valid.

    const config = error.config as FailoverRequestConfig | undefined;
    if (
      !config ||
      config.__failoverTried ||
      STOREFRONT_BASE_URLS.length < 2 ||
      !isFailoverError(error)
    ) {
      return Promise.reject(error);
    }

    const nextIndex = activeBaseIndex === 0 ? 1 : 0;
    activeBaseIndex = nextIndex;
    const newBase = STOREFRONT_BASE_URLS[nextIndex];
    storefrontHttp.defaults.baseURL = newBase;
    config.baseURL = newBase;
    config.__failoverTried = true;
    return storefrontHttp.request(config);
  },
);

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
  if (axiosErr.response?.status === 401) {
    return {
      data: null,
      message: "Unauthorized — unable to access this storefront resource.",
      status: false,
    };
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
    const res = await storefrontHttp.get(url, config);
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
    const res = await storefrontHttp.post(url, data, config);
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
    const res = await storefrontHttp.put(url, data, config);
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
    const res = await storefrontHttp.delete(url, config);
    return normalize<T>(res.data);
  } catch (err) {
    return fail<T>(err);
  }
}
