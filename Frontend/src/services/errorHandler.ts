import type { ShowToastFn, NormalizedApiError, ToastType } from '@/types';

export type { ShowToastFn, NormalizedApiError };

const DEFAULT_ERROR_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Normalize an error thrown from fetch/network layer.
 */
export function normalizeException(error: unknown): NormalizedApiError {
  if (isNormalizedApiError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return {
      message: error.message || DEFAULT_ERROR_MESSAGE,
      isNetworkError: true,
      raw: error,
    };
  }

  if (typeof error === 'string') {
    return {
      message: error || DEFAULT_ERROR_MESSAGE,
      isNetworkError: true,
      raw: error,
    };
  }

  return {
    message: DEFAULT_ERROR_MESSAGE,
    isNetworkError: true,
    raw: error,
  };
}

/**
 * Normalize a typical backend ApiError-style payload.
 * Expects shapes like: { message, code, details }.
 */
export function normalizeBackendPayload(status: number | undefined, payload: any): NormalizedApiError {
  const message = (payload && (payload.message || payload.error)) || DEFAULT_ERROR_MESSAGE;
  const details = payload && (payload.details || payload.errors);

  const isValidationError = status === 400 || (!!details && Array.isArray((details as any).errors));

  return {
    status,
    code: payload?.code,
    message,
    details,
    isValidationError,
    isNetworkError: false,
    raw: payload,
  };
}

export function isNormalizedApiError(error: unknown): error is NormalizedApiError {
  return typeof error === 'object' && error !== null && 'message' in error;
}

/**
 * Build a user-facing error message from a normalized error.
 * Tries to surface validation details when present.
 */
export function buildErrorMessage(error: NormalizedApiError, fallbackMessage?: string): string {
  // Try to unfold validation-style details: { errors: [{ path, message }, ...] }
  const details: any = error.details;

  if (details && Array.isArray(details.errors) && details.errors.length > 0) {
    return details.errors
      .map((e: any) => {
        const field = Array.isArray(e.path) ? e.path.join('.') : e.path;
        return field ? `${field}: ${e.message}` : e.message;
      })
      .join('\n');
  }

  return error.message || fallbackMessage || DEFAULT_ERROR_MESSAGE;
}

/**
 * Handle any frontend (network/IPC) error and show a toast.
 * Returns the normalized error for optional further handling by the caller.
 */
export function handleFrontendError(
  error: unknown,
  showToast: ShowToastFn,
  fallbackMessage?: string
): NormalizedApiError {
  const normalized = normalizeException(error);
  const message = buildErrorMessage(normalized, fallbackMessage);
  const type: ToastType = normalized.isValidationError ? 'warning' : 'error';

  showToast(type, message);
  return normalized;
}

/**
 * Convenience helper for handling HTTP errors: pass in the failed Response.
 * Attempts to parse JSON body and normalize backend ApiError payloads.
 */
export async function handleApiErrorResponse(
  response: Response,
  showToast: ShowToastFn,
  fallbackMessage?: string
): Promise<NormalizedApiError> {
  let body: any = null;
  try {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await response.json();
    } else {
      const text = await response.text();
      body = text ? { message: text } : null;
    }
  } catch {
    // Ignore body parsing errors; we'll fall back to status text.
  }

  const payload = body || { message: response.statusText || fallbackMessage || DEFAULT_ERROR_MESSAGE };
  const normalized = normalizeBackendPayload(response.status, payload);
  const message = buildErrorMessage(normalized, fallbackMessage);

  // Use warning for 4xx, error for 5xx and others
  const type: ToastType = response.status >= 500 ? 'error' : 'warning';
  showToast(type, message);

  return normalized;
}

/**
 * Small fetch wrapper that throws NormalizedApiError on failure.
 * UI layers can catch and pass the error into handleFrontendError.
 */
export async function apiFetch<T = unknown>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(input, init);
  } catch (error) {
    throw normalizeException(error);
  }

  let data: any = null;
  const contentType = response.headers.get('content-type') || '';

  try {
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
  } catch {
    // Ignore body parse errors; data stays null/string.
  }

  if (!response.ok) {
    const payload = typeof data === 'string' ? { message: data } : data;
    throw normalizeBackendPayload(response.status, payload);
  }

  return data as T;
}

/**
 * Helper for IPC-style results that follow the { success, error, statusCode } convention.
 * Throws NormalizedApiError when result.success is false.
 */
export function ensureIpcSuccess<T extends { success: boolean }>(
  result: T & { error?: any; statusCode?: number }
): T {
  if (result && result.success) {
    return result;
  }

  const payload = result?.error ?? result;
  const normalized = normalizeBackendPayload(result?.statusCode, payload);
  throw normalized;
}
