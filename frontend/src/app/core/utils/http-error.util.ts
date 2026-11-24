import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorBody } from '../models/api.models';

export interface FriendlyError {
  message: string;
  code: string;
  status: number;
  details?: unknown;
}

/** Turns anything thrown by the HTTP layer into one message a shop assistant can act on. */
export function toFriendlyError(error: unknown, fallback = 'Something went wrong. Try again.'): FriendlyError {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as Partial<ApiErrorBody> | null;
    if (body?.error?.message) {
      return { message: body.error.message, code: body.error.code, status: error.status, details: body.error.details };
    }
    if (error.status === 0) {
      return {
        message: 'Cannot reach the server. Check your connection and try again.',
        code: 'network_error',
        status: 0
      };
    }
    if (error.status >= 500) {
      return { message: 'The server had a problem. Try again shortly.', code: 'server_error', status: error.status };
    }
  }
  return { message: fallback, code: 'unknown', status: 0 };
}
