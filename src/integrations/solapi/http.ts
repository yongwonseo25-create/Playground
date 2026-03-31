export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type HttpHeaders = Record<string, string>;

export interface HttpRequest {
  method: HttpMethod;
  path: string;
  body?: unknown;
  headers?: HttpHeaders;
}

export interface HttpResponse<T = unknown> {
  status: number;
  data: T;
  headers: HttpHeaders;
}

export interface HttpClient {
  request<T>(request: HttpRequest): Promise<HttpResponse<T>>;
}
