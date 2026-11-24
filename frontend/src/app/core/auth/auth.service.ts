import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { CurrentUser, LoginResponse, Permission, TokenResponse } from '../models/api.models';
import { API_BASE_URL } from '../services/api-base-url.token';
import { HANDLED_BY_PAGE } from '../services/shop-api.service';

const ACCESS_KEY = 'shopkeeper.access_token';
const REFRESH_KEY = 'shopkeeper.refresh_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly base = inject(API_BASE_URL);

  private readonly sessionSig = signal<CurrentUser | null>(null);
  private readonly hasToken = signal<boolean>(Boolean(this.getAccessToken() || this.getRefreshToken()));
  private refreshInFlight$: Observable<string | null> | null = null;

  readonly session = this.sessionSig.asReadonly();
  readonly user = computed(() => this.sessionSig()?.user ?? null);
  readonly business = computed(() => this.sessionSig()?.business ?? null);
  readonly isAuthenticated = computed(() => this.hasToken());
  readonly isOwner = computed(() => this.sessionSig()?.user.role === 'owner');

  /** Where each role starts after signing in: owners see the dashboard, staff go straight to selling. */
  homeRoute(): string {
    return this.can('dashboard.view') ? '/dashboard' : '/sell';
  }

  can(permission: Permission): boolean {
    return this.sessionSig()?.permissions.includes(permission) ?? false;
  }

  login(email: string, password: string, remember: boolean): Observable<CurrentUser> {
    return this.http
      .post<LoginResponse>(
        `${this.base}/auth/login`,
        { email: email.trim(), password },
        { context: new HttpContext().set(HANDLED_BY_PAGE, true) }
      )
      .pipe(
        tap((response) => {
          this.storeTokens(response.access_token, response.refresh_token, remember);
          this.sessionSig.set({ user: response.user, business: response.business, permissions: response.permissions });
          this.hasToken.set(true);
        }),
        map((response) => ({ user: response.user, business: response.business, permissions: response.permissions }))
      );
  }

  /** On first load: turn a stored token back into a signed-in user, or report that nobody is signed in. */
  restoreSession(): Observable<CurrentUser | null> {
    if (this.sessionSig()) return of(this.sessionSig());
    if (!this.getAccessToken() && !this.getRefreshToken()) {
      this.hasToken.set(false);
      return of(null);
    }
    const loadMe = () => this.http.get<CurrentUser>(`${this.base}/auth/me`, { context: new HttpContext().set(HANDLED_BY_PAGE, true) });
    const start$ = this.getAccessToken() ? loadMe() : this.refreshAccessToken().pipe(switchMap((token) => (token ? loadMe() : of(null))));
    return start$.pipe(
      tap((me) => {
        if (me) this.sessionSig.set(me);
      }),
      catchError(() => {
        this.clearSession();
        return of(null);
      })
    );
  }

  refreshAccessToken(): Observable<string | null> {
    if (this.refreshInFlight$) return this.refreshInFlight$;
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return of(null);

    this.refreshInFlight$ = this.http
      .post<TokenResponse>(
        `${this.base}/auth/refresh`,
        { refresh_token: refreshToken },
        { context: new HttpContext().set(HANDLED_BY_PAGE, true) }
      )
      .pipe(
        map((response) => {
          this.storeTokens(response.access_token, response.refresh_token, this.refreshIsRemembered());
          return response.access_token;
        }),
        catchError((error) => {
          this.clearSession();
          return throwError(() => error);
        }),
        finalize(() => (this.refreshInFlight$ = null)),
        shareReplay(1)
      );
    return this.refreshInFlight$;
  }

  logout(): Observable<void> {
    const refreshToken = this.getRefreshToken();
    return this.http
      .post<void>(`${this.base}/auth/logout`, { refresh_token: refreshToken }, { context: new HttpContext().set(HANDLED_BY_PAGE, true) })
      .pipe(
        catchError(() => of(void 0)),
        tap(() => {
          this.clearSession();
          this.router.navigate(['/login']);
        })
      );
  }

  /** Called when the server says the session is over and refreshing did not help. */
  endSession(): void {
    this.clearSession();
    this.router.navigate(['/login'], { queryParams: { expired: '1' } });
  }

  getAccessToken(): string | null {
    return this.read(sessionStorage, ACCESS_KEY);
  }

  private getRefreshToken(): string | null {
    return this.read(localStorage, REFRESH_KEY) ?? this.read(sessionStorage, REFRESH_KEY);
  }

  private refreshIsRemembered(): boolean {
    return this.read(localStorage, REFRESH_KEY) !== null;
  }

  private storeTokens(access: string, refresh: string, remember: boolean): void {
    this.write(sessionStorage, ACCESS_KEY, access);
    // "Remember me" keeps the refresh token across browser restarts; otherwise it dies with the tab.
    this.write(remember ? localStorage : sessionStorage, REFRESH_KEY, refresh);
    this.remove(remember ? sessionStorage : localStorage, REFRESH_KEY);
  }

  private clearSession(): void {
    this.remove(sessionStorage, ACCESS_KEY);
    this.remove(sessionStorage, REFRESH_KEY);
    this.remove(localStorage, REFRESH_KEY);
    this.sessionSig.set(null);
    this.hasToken.set(false);
  }

  // Storage can throw (blocked cookies, private mode). The app then simply behaves as signed out.
  private read(store: Storage, key: string): string | null {
    try {
      return store.getItem(key);
    } catch {
      return null;
    }
  }
  private write(store: Storage, key: string, value: string): void {
    try {
      store.setItem(key, value);
    } catch {
      /* ignored */
    }
  }
  private remove(store: Storage, key: string): void {
    try {
      store.removeItem(key);
    } catch {
      /* ignored */
    }
  }
}
