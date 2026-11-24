import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { API_BASE_URL } from '../services/api-base-url.token';

const NO_TOKEN_PATHS = ['/auth/login', '/auth/refresh', '/auth/logout', '/public/'];

function withToken(request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
}

export const authInterceptor: HttpInterceptorFn = (request, next: HttpHandlerFn) => {
  const auth = inject(AuthService);
  const base = inject(API_BASE_URL);

  // Never send the token anywhere except our own API, and never to the endpoints that do not need it.
  const isApi = request.url.startsWith(base);
  const needsToken = isApi && !NO_TOKEN_PATHS.some((path) => request.url.includes(path));
  if (!needsToken) return next(request);

  return next(withToken(request, auth.getAccessToken())).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      // The access token expired: swap the refresh token for a new one, then repeat the request once.
      return auth.refreshAccessToken().pipe(
        switchMap((token) => (token ? next(withToken(request, token)) : throwError(() => error))),
        catchError((refreshError) => {
          auth.endSession();
          return throwError(() => refreshError);
        })
      );
    })
  );
};
