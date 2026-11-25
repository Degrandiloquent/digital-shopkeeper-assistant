import { Component, inject, signal } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Order } from '../../core/models/api.models';
import { ShopApi } from '../../core/services/shop-api.service';
import { formatMoney, formatDateTime } from '../../core/utils/format';
import { EmptyStateComponent, ErrorStateComponent, SkeletonComponent } from '../../shared/components/state.components';
import { icons } from '../../shared/icons';

@Component({
  selector: 'app-orders',
  imports: [FaIconComponent, ErrorStateComponent, SkeletonComponent, EmptyStateComponent],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss'
})
export class OrdersComponent {
  private readonly api = inject(ShopApi);

  protected readonly icons = icons;
  protected readonly money = formatMoney;
  protected readonly dateTime = formatDateTime;

  protected readonly orders = signal<Order[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly markingDone = signal<Set<string>>(new Set());

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.api.listPendingOrders().subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      }
    });
  }

  protected shortId(id: string): string {
    return id.slice(0, 8).toUpperCase();
  }

  protected markDone(order: Order): void {
    this.markingDone.update((s) => new Set([...s, order.id]));
    this.api.markOrderDone(order.id).subscribe({
      next: () => {
        this.markingDone.update((s) => { const next = new Set(s); next.delete(order.id); return next; });
        this.orders.update((list) => list.filter((o) => o.id !== order.id));
      },
      error: () => {
        this.markingDone.update((s) => { const next = new Set(s); next.delete(order.id); return next; });
      }
    });
  }

  protected isMarking(id: string): boolean {
    return this.markingDone().has(id);
  }

  protected itemSummary(order: Order): string {
    return order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ');
  }
}
