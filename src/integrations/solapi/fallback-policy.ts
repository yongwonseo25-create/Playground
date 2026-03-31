export type FallbackType = "NONE" | "SMS" | "LMS";
export type PreferredFallbackChannel = "SMS" | "LMS";

export interface SolapiPrimaryFailure {
  httpStatus?: number;
  statusCode?: string;
}

export function isKakaoRecipientIneligible(code?: string): boolean {
  return code === "3104" || code === "3107";
}

export function isKakaoConfigOrTemplateError(code?: string): boolean {
  return code === "3105" || code === "3106" || /^41\d{2}$/.test(code ?? "");
}

export function isRetryableTransportError(httpStatus?: number): boolean {
  return httpStatus === 429 || (httpStatus !== undefined && httpStatus >= 500);
}

export function chooseFallback(
  text: string,
  preferred: PreferredFallbackChannel,
): FallbackType {
  if (preferred === "LMS") {
    return "LMS";
  }

  if (text.length > 90 || text.includes("\n")) {
    return "LMS";
  }

  return "SMS";
}

export function decideFallbackRoute(
  failure: SolapiPrimaryFailure,
  text: string,
  preferred: PreferredFallbackChannel,
): FallbackType {
  if (isRetryableTransportError(failure.httpStatus)) {
    return "NONE";
  }

  if (
    isKakaoRecipientIneligible(failure.statusCode) ||
    isKakaoConfigOrTemplateError(failure.statusCode)
  ) {
    return chooseFallback(text, preferred);
  }

  return "NONE";
}
