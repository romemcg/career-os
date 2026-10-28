// Browser-side helper for calling the CareerOS API.

export type ApiErrorBody = { code: string; message: string; details: { path?: string; message: string }[] };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message);
  }

  fieldErrors(): Record<string, string> {
    return Object.fromEntries(this.body.details.filter((d) => d.path).map((d) => [d.path as string, d.message]));
  }
}

export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown; headers?: HeadersInit } = {},
): Promise<T> {
  const isForm = init.body instanceof FormData;
  const response = await fetch(path, {
    method: init.method ?? "GET",
    credentials: "same-origin",
    headers: { ...(init.body !== undefined && !isForm ? { "content-type": "application/json" } : {}), ...init.headers },
    body: init.body === undefined ? undefined : isForm ? (init.body as FormData) : JSON.stringify(init.body),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined" && !path.includes("/auth/login")) {
      // Full reload on expired sessions clears any client state.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/login");
    }
    throw new ApiError(
      response.status,
      json?.error ?? { code: "INTERNAL_ERROR", message: "Request failed", details: [] },
    );
  }
  return json.data as T;
}
