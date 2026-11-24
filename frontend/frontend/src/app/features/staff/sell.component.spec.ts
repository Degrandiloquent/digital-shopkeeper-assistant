import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Product, Sale } from '../../core/models/api.models';
import { API_BASE_URL } from '../../core/services/api-base-url.token';
import { SellComponent } from './sell.component';

const API = 'http://api.test/api/v1';
const product = (id: string, name: string, price: number, stock: number): Product => ({
  id, name, category: 'Groceries', price_cents: price, stock_qty: stock, low_stock_threshold: 2,
  is_active: true, is_featured: true, updated_at: '2026-11-23T10:00:00Z',
  stock_state: stock === 0 ? 'out_of_stock' : stock <= 2 ? 'low_stock' : 'in_stock'
});

describe('SellComponent basket', () => {
  let controller: HttpTestingController;
  // The class keeps its working state in protected members, so the tests reach in through this view of it.
  let cmp: any;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: API }]
    });
    controller = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(SellComponent);
    cmp = fixture.componentInstance;
    controller.expectOne(`${API}/products`).flush([product('a', 'Bread', 2000, 10), product('b', 'Oil', 5000, 2)]);
  });

  afterEach(() => controller.verify());

  it('adds products and totals the sale in cents', () => {
    cmp.add(cmp.products()[0]);
    cmp.add(cmp.products()[0]);
    cmp.add(cmp.products()[1]);
    expect(cmp.units()).toBe(3);
    expect(cmp.total()).toBe(2 * 2000 + 5000);
  });

  it('never lets the basket go past the stock on the shelf', () => {
    const oil = cmp.products()[1];
    cmp.setQty(oil, 99);
    expect(cmp.qty(oil)).toBe(2);
    expect(cmp.saleError()).toContain('Only 2 of Oil');
  });

  it('removes a line when the quantity reaches zero', () => {
    const bread = cmp.products()[0];
    cmp.add(bread);
    cmp.setQty(bread, 0);
    expect(cmp.lines().length).toBe(0);
  });

  it('records the sale, updates stock from the response and keeps the same ref on a retry', () => {
    const bread = cmp.products()[0];
    cmp.setQty(bread, 3);
    cmp.submit();
    const first = controller.expectOne(`${API}/sales`);
    const ref = first.request.body.client_ref;
    expect(first.request.body.items).toEqual([{ product_id: 'a', quantity: 3 }]);
    first.error(new ProgressEvent('error'), { status: 0 });
    expect(cmp.saleError()).toContain('NOT recorded');

    cmp.submit();
    const retry = controller.expectOne(`${API}/sales`);
    expect(retry.request.body.client_ref).toBe(ref); // same sale, so the server can never record it twice
    retry.flush({
      id: 's1', created_at: '2026-11-23T10:00:00Z', total_cents: 6000, unit_count: 3, cashier_name: 'Sam', replayed: false,
      items: [{ product_id: 'a', product_name: 'Bread', quantity: 3, unit_price_cents: 2000, line_total_cents: 6000, stock_after: 7, stock_state: 'in_stock' }]
    } as Sale);

    expect(cmp.confirmation().total_cents).toBe(6000);
    expect(cmp.products()[0].stock_qty).toBe(7);
    expect(cmp.lines().length).toBe(0);
  });

  it('shows the server message and reloads stock when a sale is refused', () => {
    cmp.setQty(cmp.products()[0], 1);
    cmp.submit();
    controller.expectOne(`${API}/sales`).flush(
      { error: { code: 'insufficient_stock', message: 'Not enough stock: Bread has 0 left, you asked for 1.' } },
      { status: 409, statusText: 'Conflict' }
    );
    expect(cmp.saleError()).toContain('Not enough stock');
    controller.expectOne(`${API}/products`).flush([product('a', 'Bread', 2000, 0)]);
    expect(cmp.lines().length).toBe(0);
  });
});
