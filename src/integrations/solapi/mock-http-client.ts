import type { HttpClient, HttpRequest, HttpResponse } from "./http";

interface MockQueueItem<T = unknown> {
  match: Partial<HttpRequest>;
  response: HttpResponse<T>;
}

function matchesRequest(match: Partial<HttpRequest>, request: HttpRequest): boolean {
  return (
    (match.method === undefined || match.method === request.method) &&
    (match.path === undefined || match.path === request.path)
  );
}

export class MockHttpClient implements HttpClient {
  private readonly queue: MockQueueItem[] = [];

  enqueue<T>(match: Partial<HttpRequest>, response: HttpResponse<T>): void {
    this.queue.push({ match, response });
  }

  async request<T>(request: HttpRequest): Promise<HttpResponse<T>> {
    const index = this.queue.findIndex((item) =>
      matchesRequest(item.match, request),
    );

    if (index === -1) {
      throw new Error(`MOCK_NOT_FOUND: ${request.method} ${request.path}`);
    }

    const [found] = this.queue.splice(index, 1);
    return found.response as HttpResponse<T>;
  }
}
