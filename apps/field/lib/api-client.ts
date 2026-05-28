import { getSession } from './auth-storage';

// HTTP client for the Field App.
//
// All requests go through this so the JWT token is auto-injected and the SRS §5.3
// response envelope ({ success, data?, error? }) is unwrapped consistently.
// Throws ApiError on { success: false } so callers can `catch` and route on code.

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export interface ApiErrorDetails {
  enrollmentToken?: string;
  [key: string]: unknown;
}

export class ApiError extends Error {
  public code: string;
  public status: number;
  public details: ApiErrorDetails;

  constructor(code: string, message: string, status: number, details: ApiErrorDetails = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (session?.token) {
    headers.Authorization = `Bearer ${session.token}`;
  }

  let resp: Response;
  try {
    resp = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch (err) {
    throw new ApiError('NETWORK_ERROR', 'Network unreachable', 0, {});
  }

  let body: any;
  try {
    body = await resp.json();
  } catch {
    throw new ApiError('BAD_RESPONSE', `Server returned non-JSON ${resp.status}`, resp.status);
  }

  if (body && body.success === true) {
    return body.data as T;
  }

  const code = body?.error?.code ?? 'UNKNOWN_ERROR';
  const message = body?.error?.message ?? 'Request failed';
  const details = (body?.error?.details ?? {}) as ApiErrorDetails;
  throw new ApiError(code, message, resp.status, details);
}

// Convenience wrappers ------------------------------------------------------

export function apiGet<T>(path: string): Promise<T> {
  return api<T>(path, { method: 'GET' });
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return api<T>(path, { method: 'POST', body: JSON.stringify(body) });
}
