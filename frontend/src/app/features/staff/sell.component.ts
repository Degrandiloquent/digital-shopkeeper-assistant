import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { AuthService } from '../../core/auth/auth.service';
import { Product, Sale } from '../../core/models/api.models';
import { ShopApi } from '../../core/services/shop-api.service';
import { ToastService } from '../../core/services/toast.service';
import { copyText, newClientRef } from '../../core/utils/clipboard';
import { formatMoney, formatTime, plural } from '../../core/utils/format';
import { toFriendlyError } from '../../core/utils/http-error.util';
import { buildReceiptMessage } from '../../core/utils/messages';
import { ErrorStateComponent, SkeletonComponent, EmptyStateComponent } from '../../shared/components/state.components';
import { StockBadgeComponent } from '../../shared/components/stock-badge.component';
import { icons } from '../../shared/icons';

interface BasketLine {
  product: Product;
  quantity: number;
  lineTotal: number;
}

@Component({
  selector: 'app-sell',
  imports: [FormsModule, FaIconComponent, StockBadgeComponent, ErrorStateComponent, SkeletonComponent, EmptyStateComponent],
  templateUrl: './sell.component.html',
  styleUrl: './sell.component.scss'
})
export class SellComponent {
  private readonly api = inject(ShopApi);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  protected readonly icons = icons;
  protected readonly money = formatMoney;
  protected readonly time = formatTime;
  protected readonly plural = plural;

  protected readonly products = signal<Product[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly search = signal('');
  protected readonly category = signal<string | null>(null);
  protected readonly basket = signal<Record<string, number>>({});
  protected readonly submitting = signal(false);
  protected readonly saleError = signal('');
  protected readonly confirmation = signal<Sale | null>(null);
  protected readonly basketOpen = signal(false);
  private clientRef = newClientRef();

  protected readonly categories = computed(() => [...new Set(this.products().map((p) => p.category))].sort());

  protected readonly visible = computed(() => {
    const term = this.search().trim().toLowerCase();
    const category = this.category();
    return this.products().filter(
      (p) => (!category || p.category === category) && (!term || p.name.toLowerCase().includes(term))
    );
  });

  protected readonly lines = computed<BasketLine[]>(() => {
    const quantities = this.basket();
    return this.products()
      .filter((p) => quantities[p.id] > 0)
      .map((product) => ({ product, quantity: quantities[product.id], lineTotal: quantities[product.id] * product.price_cents }));
  });
  protected readonly total = computed(() => this.lines().reduce((sum, line) => sum + line.lineTotal, 0));
  protected readonly units = computed(() => this.lines().reduce((sum, line) => sum + line.quantity, 0));
  protected readonly shopName = computed(() => this.auth.business()?.name ?? 'Shop');

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.api.products().subscribe({
      next: (products) => {
        this.products.set(products);
        // Drop basket lines for products that disappeared, and clamp the rest to the stock now on the shelf.
        const next: Record<string, number> = {};
        for (const product of products) {
          const wanted = this.basket()[product.id] ?? 0;
          if (wanted > 0 && product.stock_qty > 0) next[product.id] = Math.min(wanted, product.stock_qty);
        }
        this.basket.set(next);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadFailed.set(true);
      }
    });
  }

  protected qty(product: Product): number {
    return this.basket()[product.id] ?? 0;
  }

  protected add(product: Product): void {
    this.setQty(product, this.qty(product) + 1);
  }

  protected setQty(product: Product, value: number): void {
    const wanted = Number.isFinite(value) ? Math.floor(value) : 0;
    const clamped = Math.max(0, Math.min(wanted, product.stock_qty));
    if (wanted > product.stock_qty) {
      this.saleError.set(`Only ${product.stock_qty} of ${product.name} in stock.`);
    } else {
      this.saleError.set('');
    }
    this.basket.update((current) => {
      const next = { ...current };
      if (clamped > 0) next[product.id] = clamped;
      else delete next[product.id];
      return next;
    });
    this.clientRef = newClientRef(); // A changed basket is a different sale.
  }

  protected onQtyInput(product: Product, event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.setQty(product, raw === '' ? 0 : Number(raw));
    (event.target as HTMLInputElement).value = String(this.qty(product));
  }

  protected clear(): void {
    this.basket.set({});
    this.saleError.set('');
    this.basketOpen.set(false);
    this.clientRef = newClientRef();
  }

  protected submit(): void {
    if (this.submitting() || this.lines().length === 0) return;
    this.submitting.set(true);
    this.saleError.set('');
    const items = this.lines().map((line) => ({ product_id: line.product.id, quantity: line.quantity }));

    this.api.createSale(items, this.clientRef).subscribe({
      next: (sale) => {
        this.submitting.set(false);
        // Show the new counts at once, without waiting for another round trip.
        this.products.update((list) =>
          list.map((product) => {
            const item = sale.items.find((i) => i.product_id === product.id);
            return item && item.stock_after !== null && item.stock_state
              ? { ...product, stock_qty: item.stock_after, stock_state: item.stock_state }
              : product;
          })
        );
        this.basket.set({});
        this.basketOpen.set(false);
        this.confirmation.set(sale);
        this.clientRef = newClientRef();
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        const friendly = toFriendlyError(error, 'The sale was not recorded. Try again.');
        if (error instanceof HttpErrorResponse && error.status === 0) {
          this.saleError.set('No connection, so this sale was NOT recorded. Press Record sale again when you are back online. It will not be recorded twice.');
        } else {
          this.saleError.set(friendly.message);
          // Stock changed under us (409) or a product was archived: show the real counts.
          if (friendly.status === 409 || friendly.status === 404) this.load();
        }
      }
    });
  }

  protected newSale(): void {
    this.confirmation.set(null);
  }

  protected async copyReceipt(): Promise<void> {
    const sale = this.confirmation();
    if (!sale) return;
    const ok = await copyText(buildReceiptMessage(this.shopName(), sale));
    if (ok) this.toasts.success('Receipt message copied.');
    else this.toasts.warning('Could not copy. Select the text and copy it by hand.');
  }

  protected receiptPreview(): string {
    const sale = this.confirmation();
    return sale ? buildReceiptMessage(this.shopName(), sale) : '';
  }
}
