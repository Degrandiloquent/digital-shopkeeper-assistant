import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { API_BASE_URL } from '../services/api-base-url.token';
import { WakeService } from '../services/wake.service';

const SLOW_AFTER_MS = 3500;

/** If a request to the API is still waiting after a few seconds, the free-tier server is probably waking up. */
export const wakeInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(inject(API_BASE_URL))) return next(request);
  const wake = inject(WakeService);
  let flagged = false;
  const timer = setTimeout(() => {
    flagged = true;
    wake.begin();
  }, SLOW_AFTER_MS);

  return next(request).pipe(
    finalize(() => {
      clearTimeout(timer);
      if (flagged) wake.end();
    })
  );
};
