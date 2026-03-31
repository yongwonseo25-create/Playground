import type { HttpClient, HttpHeaders, HttpRequest, HttpResponse } from "./http";

const EMPTY_HEADERS: HttpHeaders = {};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function toHeaders(headers: Headers): HttpHeaders {
  return Object.fromEntries(headers.entries());
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text.length > 0 ? text : null;
}

export class FetchHttpClient implements HttpClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = normalizeBaseUrl(baseUrl);
  }

  async request<T>(request: HttpRequest): Promise<HttpResponse<T>> {
    const response = await fetch(`${this.baseUrl}${request.path}`, {
      method: request.method,
      headers: request.headers ?? EMPTY_HEADERS,
      body:
        request.body === undefined ? undefined : JSON.stringify(request.body),
    });

    const data = (await parseResponseBody(response)) as T;

    return {
      status: response.status,
      data,
      headers: toHeaders(response.headers),
    };
  }
}
