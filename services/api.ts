const DEFAULT_TIMEOUT_MS = 15_000;

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type QueryValue = string | number | boolean | null | undefined;

export type ApiErrorCode =
  | "CONFIGURATION"
  | "TIMEOUT"
  | "ABORTED"
  | "NETWORK"
  | "HTTP";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: ApiErrorCode,
    public readonly status?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiRequestOptions<TBody = unknown> = Omit<
  RequestInit,
  "body" | "method"
> & {
  method?: HttpMethod;
  body?: TBody;
  query?: Record<string, QueryValue | readonly QueryValue[]>;
  timeoutMs?: number;
  token?: string | null;
};

function getApiBaseUrl(): string {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (!apiUrl) {
    throw new ApiError(
      "EXPO_PUBLIC_API_URL is not configured. Copy .env.example to .env.local and set your API URL.",
      "CONFIGURATION"
    );
  }

  return apiUrl.replace(/\/+$/, "");
}

function buildUrl(
  path: string,
  query?: ApiRequestOptions["query"]
): string {
  const normalizedPath = path.replace(/^\/+/, "");
  const url = new URL(`${getApiBaseUrl()}/${normalizedPath}`);

  for (const [key, rawValue] of Object.entries(query ?? {})) {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];

    for (const value of values) {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    }
  }

  return url.toString();
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;

  const text = await response.text();
  if (!text) return undefined;

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return text;
}

function getErrorMessage(payload: unknown, status: number): string {
  if (
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }

  if (typeof payload === "string" && payload.trim()) return payload;
  return `API request failed with status ${status}`;
}

export async function apiRequest<TResponse, TBody = unknown>(
  path: string,
  options: ApiRequestOptions<TBody> = {}
): Promise<TResponse> {
  const {
    body,
    headers: customHeaders,
    method = "GET",
    query,
    signal: externalSignal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    token,
    ...fetchOptions
  } = options;

  const controller = new AbortController();
  let timedOut = false;

  const handleExternalAbort = () => controller.abort();
  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener("abort", handleExternalAbort);
  }

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const headers = new Headers(customHeaders);
  headers.set("Accept", "application/json");

  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    const response = await fetch(buildUrl(path, query), {
      ...fetchOptions,
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const payload = await parseResponse(response);

    if (!response.ok) {
      throw new ApiError(
        getErrorMessage(payload, response.status),
        "HTTP",
        response.status,
        payload
      );
    }

    return payload as TResponse;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (controller.signal.aborted) {
      throw new ApiError(
        timedOut ? `API request timed out after ${timeoutMs}ms` : "API request was cancelled",
        timedOut ? "TIMEOUT" : "ABORTED"
      );
    }

    throw new ApiError(
      error instanceof Error ? error.message : "Unable to reach the API",
      "NETWORK",
      undefined,
      error
    );
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", handleExternalAbort);
  }
}

type MethodOptions<TBody = unknown> = Omit<
  ApiRequestOptions<TBody>,
  "body" | "method"
>;

export const api = {
  get: <TResponse>(path: string, options?: MethodOptions) =>
    apiRequest<TResponse>(path, { ...options, method: "GET" }),

  post: <TResponse, TBody = unknown>(
    path: string,
    body: TBody,
    options?: MethodOptions<TBody>
  ) => apiRequest<TResponse, TBody>(path, { ...options, method: "POST", body }),

  put: <TResponse, TBody = unknown>(
    path: string,
    body: TBody,
    options?: MethodOptions<TBody>
  ) => apiRequest<TResponse, TBody>(path, { ...options, method: "PUT", body }),

  patch: <TResponse, TBody = unknown>(
    path: string,
    body: TBody,
    options?: MethodOptions<TBody>
  ) => apiRequest<TResponse, TBody>(path, { ...options, method: "PATCH", body }),

  delete: <TResponse>(path: string, options?: MethodOptions) =>
    apiRequest<TResponse>(path, { ...options, method: "DELETE" }),
};
