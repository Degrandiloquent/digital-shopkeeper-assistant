import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { HANDLED_BY_PAGE } from '../services/shop-api.service';
import { ToastService } from '../services/toast.service';
import { toFriendlyError } from '../utils/http-error.util';

/** One calm message for problems that no single page owns. Requests marked HANDLED_BY_PAGE show their own. */
export const errorInterceptor: HttpInterceptorFn = (request, next) => {
  const toasts = inject(ToastService);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && !request.context.get(HANDLED_BY_PAGE)) {
        if (error.status === 0 || error.status >= 500) {
          toasts.error(toFriendlyError(error).message);
        } else if (error.status === 403) {
          toasts.warning('You do not have permission to do that.');
        } else if (error.status === 429) {
          toasts.warning(toFriendlyError(error).message);
        }
      }
      return throwError(() => error);
    })
  );
};
