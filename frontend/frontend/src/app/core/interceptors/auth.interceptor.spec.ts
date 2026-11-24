import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { API_BASE_URL } from '../services/api-base-url.token';
import { authInterceptor } from './auth.interceptor';

const API = 'http://api.test/api/v1';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: API }
      ]
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('attaches the access token to API calls', () => {
    sessionStorage.setItem('shopkeeper.access_token', 'abc');
    http.get(`${API}/products`).subscribe();
    expect(controller.expectOne(`${API}/products`).request.headers.get('Authorization')).toBe('Bearer abc');
  });

  it('never sends the token to the public endpoint or to other sites', () => {
    sessionStorage.setItem('shopkeeper.access_token', 'abc');
    http.get(`${API}/public/business/x`).subscribe();
    expect(controller.expectOne(`${API}/public/business/x`).request.headers.has('Authorization')).toBeFalse();
    http.get('https://elsewhere.test/data').subscribe();
    expect(controller.expectOne('https://elsewhere.test/data').request.headers.has('Authorization')).toBeFalse();
  });

  it('refreshes an expired token once and repeats the request', () => {
    sessionStorage.setItem('shopkeeper.access_token', 'old');
    sessionStorage.setItem('shopkeeper.refresh_token', 'refresh-1');
    let body: unknown;
    http.get(`${API}/products`).subscribe((value) => (body = value));

    controller.expectOne(`${API}/products`).flush({ error: { code: 'unauthorized' } }, { status: 401, statusText: 'Unauthorized' });
    const refresh = controller.expectOne(`${API}/auth/refresh`);
    expect(refresh.request.body).toEqual({ refresh_token: 'refresh-1' });
    refresh.flush({ access_token: 'new', refresh_token: 'refresh-2', token_type: 'bearer', access_token_expires_in: 1800 });

    const retry = controller.expectOne(`${API}/products`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new');
    retry.flush([{ id: 1 }]);
    expect(body).toEqual([{ id: 1 }]);
    expect(sessionStorage.getItem('shopkeeper.refresh_token')).toBe('refresh-2');
  });

  it('signs the user out when refreshing fails', () => {
    sessionStorage.setItem('shopkeeper.access_token', 'old');
    sessionStorage.setItem('shopkeeper.refresh_token', 'dead');
    let failed = false;
    http.get(`${API}/products`).subscribe({ error: () => (failed = true) });

    controller.expectOne(`${API}/products`).flush({}, { status: 401, statusText: 'Unauthorized' });
    controller.expectOne(`${API}/auth/refresh`).flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(failed).toBeTrue();
    expect(TestBed.inject(AuthService).getAccessToken()).toBeNull();
  });
});
