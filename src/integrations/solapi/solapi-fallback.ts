export type FallbackChannel = 'SMS' | 'LMS';
export type FallbackRoute = 'NONE' | FallbackChannel;

export interface PrimarySendResult {
  ok: boolean;
  statusCode?: string;
  statusMessage?: string;
  messageId?: string;
  httpStatus?: number;
}

export interface FallbackDecision {
  route: FallbackRoute;
  shouldAlert: boolean;
  shouldRetryPrimary: boolean;
  reason:
    | 'PRIMARY_OK'
    | 'RETRYABLE_TRANSPORT'
    | 'RECIPIENT_INELIGIBLE'
    | 'CONFIG_OR_TEMPLATE_ERROR'
    | 'UNKNOWN_NON_RETRYABLE';
}

export function isKakaoRecipientIneligible(code?: string): boolean {
  return code === '3104' || code === '3107';
}

export function isKakaoConfigOrTemplateError(code?: string): boolean {
  return code === '3105' || code === '3106' || /^41\d{2}$/.test(code ?? '');
}

export function isRetryableTransportError(httpStatus?: number): boolean {
  return httpStatus === 429 || (httpStatus != null && httpStatus >= 500);
}

export function chooseFallback(text: string, preferred: FallbackChannel): FallbackChannel {
  if (preferred === 'LMS') {
    return 'LMS';
  }

  if (text.length > 90 || text.includes('\n')) {
    return 'LMS';
  }

  return 'SMS';
}

export function decideFallback(
  result: PrimarySendResult,
  preferred: FallbackChannel,
  text: string,
): FallbackDecision {
  if (result.ok) {
    return {
      route: 'NONE',
      shouldAlert: false,
      shouldRetryPrimary: false,
      reason: 'PRIMARY_OK',
    };
  }

  if (isRetryableTransportError(result.httpStatus)) {
    return {
      route: 'NONE',
      shouldAlert: false,
      shouldRetryPrimary: true,
      reason: 'RETRYABLE_TRANSPORT',
    };
  }

  if (isKakaoRecipientIneligible(result.statusCode)) {
    return {
      route: chooseFallback(text, preferred),
      shouldAlert: false,
      shouldRetryPrimary: false,
      reason: 'RECIPIENT_INELIGIBLE',
    };
  }

  if (isKakaoConfigOrTemplateError(result.statusCode)) {
    return {
      route: chooseFallback(text, preferred),
      shouldAlert: true,
      shouldRetryPrimary: false,
      reason: 'CONFIG_OR_TEMPLATE_ERROR',
    };
  }

  return {
    route: 'NONE',
    shouldAlert: false,
    shouldRetryPrimary: false,
    reason: 'UNKNOWN_NON_RETRYABLE',
  };
}
