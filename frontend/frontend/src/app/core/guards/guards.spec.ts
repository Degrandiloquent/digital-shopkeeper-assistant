import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { CurrentUser, Permission } from '../models/api.models';
import { permissionGuard } from './guards';

function setSession(auth: AuthService, permissions: Permission[]): void {
  const me: CurrentUser = {
    user: { id: '1', name: 'Sam', email: 's@x.demo', role: 'staff', last_login_at: null },
    business: { id: 'b', slug: 's', name: 'Shop', area_label: 'Area', status: 'open' },
    permissions
  };
  (auth as unknown as { sessionSig: { set(v: CurrentUser): void } }).sessionSig.set(me);
}

describe('permissionGuard', () => {
  let auth: AuthService;
  const route = (permission?: Permission) => ({ data: { permission } }) as unknown as ActivatedRouteSnapshot;
  const run = (permission?: Permission) => TestBed.runInInjectionContext(() => permissionGuard(route(permission), {} as never));

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
  });

  it('lets people through when they hold the permission', () => {
    setSession(auth, ['sales.create']);
    expect(run('sales.create')).toBeTrue();
  });

  it('sends staff away from owner-only pages', () => {
    setSession(auth, ['sales.create', 'products.view']);
    const result = run('business.manage');
    expect(result instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/access-denied');
  });

  it('routes each role to a sensible home', () => {
    setSession(auth, ['sales.create']);
    expect(auth.homeRoute()).toBe('/sell');
    setSession(auth, ['sales.create', 'dashboard.view']);
    expect(auth.homeRoute()).toBe('/dashboard');
  });
});
