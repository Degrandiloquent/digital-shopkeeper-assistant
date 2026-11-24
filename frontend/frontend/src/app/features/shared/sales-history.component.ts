import { Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { SaleList, SalesPeriod } from '../../core/models/api.models';
import { ShopApi } from '../../core/services/shop-api.service';
import { formatDateTime, formatMoney, plural } from '../../core/utils/format';
import { EmptyStateComponent, ErrorStateComponent, SkeletonComponent } from '../../shared/components/state.components';
import { icons } from '../../shared/icons';

const PERIODS: { value: SalesPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All time' }
];

@Component({
  selector: 'app-sales-history',
  imports: [EmptyStateComponent, ErrorStateComponent, SkeletonComponent],
  template: `
    <div class="page">
      <div class="page-heading">
        <div>
          <h1>{{ owner() ? 'Sales' : 'My sales' }}</h1>
          <p>{{ owner() ? 'Every sale recorded in the shop.' : 'The sales you have recorded.' }} Prices are kept as they were at the time of sale.</p>
        </div>
      </div>

      <section class="card flush">
        <div class="bar">
          <div class="chips" role="group" aria-label="Time period">
            @for (p of periods; track p.value) {
              <button type="button" class="chip" [attr.aria-pressed]="period() === p.value" (click)="setPeriod(p.value)">{{ p.label }}</button>
            }
          </div>
          @if (data(); as d) {
            <p class="summary"><strong class="num">{{ money(d.total_cents) }}</strong> <span class="muted">from {{ plural(d.sale_count, 'sale') }}</span></p>
          }
        </div>

        @if (loading()) {
          <div style="padding: 1rem"><app-skeleton [count]="5" [height]="48" /></div>
        } @else if (failed()) {
          <app-error-state message="We could not load sales." (retry)="load()" />
        } @else if (data()?.items?.length === 0) {
          <app-empty-state [icon]="icons.receipt" title="No sales in this period" message="Sales you record will appear here." />
        } @else {
          <div class="table-wrap">
            <table class="data stack-mobile">
              <thead><tr><th>When</th><th>Items</th>@if (owner()) {<th>Recorded by</th>}<th class="right">Total</th></tr></thead>
              <tbody>
                @for (sale of data()!.items; track sale.id) {
                  <tr>
                    <td data-label="When" class="nowrap">{{ when(sale.created_at) }}</td>
                    <td data-label="Items">
                      @for (item of sale.items; track item.product_id) { <div>{{ item.quantity }} × {{ item.product_name }} <span class="muted num">({{ money(item.unit_price_cents) }})</span></div> }
                    </td>
                    @if (owner()) { <td data-label="Recorded by">{{ sale.cashier_name }}</td> }
                    <td data-label="Total" class="right num"><strong>{{ money(sale.total_cents) }}</strong></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>
  `,
  styles: ['.bar{display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;padding:0.85rem 1rem;border-bottom:1px solid var(--border)} .summary{font-size:0.95rem}']
})
export class SalesHistoryComponent {
  private readonly api = inject(ShopApi);
  private readonly auth = inject(AuthService);

  protected readonly icons = icons;
  protected readonly periods = PERIODS;
  protected readonly money = formatMoney;
  protected readonly plural = plural;
  protected readonly when = (iso: string) => formatDateTime(iso);

  protected readonly owner = computed(() => this.auth.can('sales.view_all'));
  protected readonly period = signal<SalesPeriod>('today');
  protected readonly data = signal<SaleList | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  constructor() {
    this.load();
  }

  protected setPeriod(period: SalesPeriod): void {
    this.period.set(period);
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.api.sales(this.period()).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      }
    });
  }
}
