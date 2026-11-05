export type BodyType<T> = T;

export type ErrorType<T = unknown> = AdminApiError<T>;

export type CustomFetchOptions = RequestInit;

export class AdminApiError<T = unknown> extends Error {
  readonly status: number;
  readonly data: T | null;

  constructor(status: number, statusText: string, data: T | null) {
    super(`HTTP ${status} ${statusText}`);
    this.name = "AdminApiError";
    this.status = status;
    this.data = data;
  }
}

export async function customFetch<T = unknown>(
  input: RequestInfo | URL,
  options: CustomFetchOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (
    typeof options.body === "string" &&
    !headers.has("content-type") &&
    options.body.trimStart().startsWith("{")
  ) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(input, {
    ...options,
    headers,
    credentials: "include",
  });
  const raw = response.status === 204 ? "" : await response.text();
  let data: unknown = null;

  if (raw) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = raw;
    }
  }

  if (!response.ok) {
    throw new AdminApiError(
      response.status,
      response.statusText,
      data as T | null,
    );
  }

  return data as T;
}
