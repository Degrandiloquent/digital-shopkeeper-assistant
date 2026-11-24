import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { AuthService } from '../../core/auth/auth.service';
import { DashboardSummary } from '../../core/models/api.models';
import { ShopApi } from '../../core/services/shop-api.service';
import { formatMoney, formatMoneyShort, formatTime, plural, timeAgo } from '../../core/utils/format';
import { MetricCardComponent } from '../../shared/components/metric-card.component';
import { ErrorStateComponent, SkeletonComponent, EmptyStateComponent } from '../../shared/components/state.components';
import { StatusPillComponent } from '../../shared/components/status-pill.component';
import { StockBadgeComponent } from '../../shared/components/stock-badge.component';
import { icons } from '../../shared/icons';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, FaIconComponent, MetricCardComponent, StatusPillComponent, StockBadgeComponent, ErrorStateComponent, SkeletonComponent, EmptyStateComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  private readonly api = inject(ShopApi);
  private readonly auth = inject(AuthService);

  protected readonly icons = icons;
  protected readonly money = formatMoney;
  protected readonly time = formatTime;
  protected readonly plural = plural;

  protected readonly data = signal<DashboardSummary | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  protected readonly firstName = computed(() => this.auth.user()?.name.split(' ')[0] ?? '');
  protected readonly greeting = computed(() => {
    const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Africa/Johannesburg' }).format(new Date()));
    return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  });

  /** Bars for the chart. Heights are a share of the best day, with a visible stub so an empty day is still seen. */
  protected readonly bars = computed(() => {
    const days = this.data()?.sales_last_7_days ?? [];
    const max = Math.max(...days.map((d) => d.total_cents), 1);
    const slot = 100 / Math.max(days.length, 1);
    return days.map((day, index) => {
      const height = day.total_cents > 0 ? Math.max(6, (day.total_cents / max) * 150) : 3;
      return { ...day, x: index * slot + slot * 0.2, width: slot * 0.6, height, y: 170 - height, center: index * slot + slot / 2 };
    });
  });
  protected readonly chartSummary = computed(() =>
    (this.data()?.sales_last_7_days ?? []).map((d) => `${d.label} ${formatMoney(d.total_cents)}`).join(', ')
  );
  protected readonly weekTotal = computed(() => (this.data()?.sales_last_7_days ?? []).reduce((sum, d) => sum + d.total_cents, 0));

  protected readonly short = formatMoneyShort;

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.api.dashboard().subscribe({
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

  protected ago(iso: string): string {
    return timeAgo(iso);
  }
}
