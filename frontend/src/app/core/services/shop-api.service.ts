import { HttpClient, HttpContext, HttpContextToken, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  ActivityItem,
  Announcement,
  AnnouncementInput,
  Business,
  DashboardSummary,
  OpeningHours,
  Product,
  ProductInput,
  PublicShop,
  Sale,
  SaleList,
  SalesPeriod,
  ShopStatus,
  StockAdjustmentInput
} from '../models/api.models';
import { API_BASE_URL } from './api-base-url.token';

/** Set on requests whose page shows its own error message, so the global handler stays quiet. */
export const HANDLED_BY_PAGE = new HttpContextToken<boolean>(() => false);

const pageHandled = () => new HttpContext().set(HANDLED_BY_PAGE, true);

@Injectable({ providedIn: 'root' })
export class ShopApi {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  private url(path: string): string {
    return `${this.base}/${path}`;
  }

  // ----- public (no sign-in) -----
  /** `fresh` skips the browser's short cache, for when the caller has just changed something or the person
   *  pressed Refresh and must see the real current state. */
  publicShop(slug: string, fresh = false): Observable<PublicShop> {
    let params = new HttpParams();
    if (fresh) params = params.set('_', Date.now().toString());
    return this.http.get<PublicShop>(this.url(`public/business/${encodeURIComponent(slug)}`), {
      params,
      context: pageHandled()
    });
  }

  // ----- products -----
  products(options: { includeArchived?: boolean } = {}): Observable<Product[]> {
    let params = new HttpParams();
    if (options.includeArchived) params = params.set('include_archived', 'true');
    return this.http.get<Product[]>(this.url('products'), { params });
  }
  createProduct(input: ProductInput): Observable<Product> {
    return this.http.post<Product>(this.url('products'), input, { context: pageHandled() });
  }
  updateProduct(id: string, input: Partial<Omit<ProductInput, 'stock_qty'>>): Observable<Product> {
    return this.http.patch<Product>(this.url(`products/${id}`), input, { context: pageHandled() });
  }
  archiveProduct(id: string): Observable<Product> {
    return this.http.post<Product>(this.url(`products/${id}/archive`), {});
  }
  restoreProduct(id: string): Observable<Product> {
    return this.http.post<Product>(this.url(`products/${id}/restore`), {});
  }
  adjustStock(id: string, input: StockAdjustmentInput): Observable<Product> {
    return this.http.post<Product>(this.url(`products/${id}/stock-adjustments`), input, { context: pageHandled() });
  }

  // ----- sales -----
  createSale(items: { product_id: string; quantity: number }[], clientRef: string): Observable<Sale> {
    return this.http.post<Sale>(
      this.url('sales'),
      { items, client_ref: clientRef },
      { context: pageHandled() }
    );
  }
  sales(period: SalesPeriod, limit = 100): Observable<SaleList> {
    const params = new HttpParams().set('period', period).set('limit', limit);
    return this.http.get<SaleList>(this.url('sales'), { params });
  }

  // ----- owner -----
  dashboard(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(this.url('dashboard/summary'));
  }
  business(): Observable<Business> {
    return this.http.get<Business>(this.url('business'));
  }
  updateStatus(status: ShopStatus, message: string | null): Observable<Business> {
    return this.http.patch<Business>(
      this.url('business/status'),
      { status, status_message: message },
      { context: pageHandled() }
    );
  }
  updateProfile(input: { name?: string; area_label?: string; hours?: OpeningHours; contact_note?: string | null }): Observable<Business> {
    return this.http.patch<Business>(this.url('business/profile'), input, { context: pageHandled() });
  }
  announcements(): Observable<Announcement[]> {
    return this.http.get<Announcement[]>(this.url('announcements'));
  }
  createAnnouncement(input: AnnouncementInput): Observable<Announcement> {
    return this.http.post<Announcement>(this.url('announcements'), input, { context: pageHandled() });
  }
  endAnnouncement(id: string): Observable<Announcement> {
    return this.http.post<Announcement>(this.url(`announcements/${id}/end`), {});
  }
  activity(limit = 100): Observable<{ items: ActivityItem[] }> {
    return this.http.get<{ items: ActivityItem[] }>(this.url('activity'), { params: new HttpParams().set('limit', limit) });
  }
}
