import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { Permission } from '../models/api.models';

/** Sends signed-out visitors to the login page, remembering where they were going. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth
    .restoreSession()
    .pipe(map((me) => (me ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }))));
};

/** Route data: { permission: 'products.manage' }. Visitors without it land on the access-denied page.
 *  The API enforces the same rule; this only keeps people out of screens that would show nothing. */
export const permissionGuard: CanActivateFn = (route) => {
  const required = route.data['permission'] as Permission | undefined;
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!required || auth.can(required)) return true;
  return router.createUrlTree(['/access-denied']);
};

/** The login page is only for people who are not signed in. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.restoreSession().pipe(map((me) => (me ? router.createUrlTree([auth.homeRoute()]) : true)));
};
