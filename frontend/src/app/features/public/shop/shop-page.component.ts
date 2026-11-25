import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { PublicShop, DAY_KEYS, DAY_NAMES, Order, OrderItem } from '../../../core/models/api.models';
import { ShopApi } from '../../../core/services/shop-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { copyText } from '../../../core/utils/clipboard';
import { formatMoney, hoursText, STATUS_LABEL, timeAgo } from '../../../core/utils/format';
import { toFriendlyError } from '../../../core/utils/http-error.util';
import { buildUpdateMessage } from '../../../core/utils/messages';
import { PublicFooterComponent, PublicHeaderComponent } from '../../../shared/components/public-chrome.component';
import { ErrorStateComponent, SkeletonComponent } from '../../../shared/components/state.components';
import { StockBadgeComponent } from '../../../shared/components/stock-badge.component';
import { icons } from '../../../shared/icons';

const REFRESH_MS = 30_000;

interface MenuEntry {
  name: string;
  price_cents: number;
  originalPrice?: number;
  category: string;
}

interface CartLine {
  item: MenuEntry;
  quantity: number;
}

const MENU_SECTIONS: { title: string; items: MenuEntry[] }[] = [
  {
    title: 'Toasted Bread Menu',
    items: [
      { name: 'Chips, Polony, Lettuce', price_cents: 1500, category: 'Toasted Bread' },
      { name: 'Chips, Polony, Cheese, Lettuce', price_cents: 1600, category: 'Toasted Bread' },
      { name: 'Chips, Polony, Vienna, Lettuce', price_cents: 1800, category: 'Toasted Bread' },
      { name: 'Chips, Polony, Vienna, Egg, Atchaar, Lettuce', price_cents: 2000, category: 'Toasted Bread' },
      { name: 'Chips, Polony, Special, Russian, Egg, Atchaar, Lettuce', price_cents: 2300, category: 'Toasted Bread' },
      { name: 'Chips, Polony, Special, Russian, Egg, Cheese, Lettuce', price_cents: 2500, category: 'Toasted Bread' },
      { name: 'Chips, Polony, Special, Russian, Egg, Atchaar, Lettuce (Deluxe)', price_cents: 2800, category: 'Toasted Bread' },
      { name: 'Chips, Polony, Special, Vienna, Russian, Egg, Atchaar, Lettuce', price_cents: 3000, category: 'Toasted Bread' },
      { name: 'Chips, Polony, Special, Vienna, Russian, Egg, Atchaar, Lettuce (XL)', price_cents: 3300, category: 'Toasted Bread' },
      { name: 'Chips, Polony, Special, Egg, Cheese, Vienna, Russian, Atchaar, Lettuce', price_cents: 3500, category: 'Toasted Bread' },
    ]
  },
  {
    title: 'Kota Menu',
    items: [
      { name: 'Chips, Polony', price_cents: 1500, category: 'Kota' },
      { name: 'Chips, Polony, Special, Atchaar', price_cents: 1600, category: 'Kota' },
      { name: 'Chips, Polony, Special, Egg, Atchaar, Lettuce', price_cents: 1800, category: 'Kota' },
      { name: 'Chips, Polony, Cheese, Egg, Atchaar, Lettuce', price_cents: 2000, category: 'Kota' },
      { name: 'Chips, Polony, Special, Russian, Atchaar', price_cents: 2300, category: 'Kota' },
      { name: 'Chips, Polony, Special, Russian, Vienna, Cheese, Atchaar, Lettuce (Special)', price_cents: 2800, originalPrice: 3500, category: 'Kota' },
      { name: 'Chips, Polony, Special, Russian, Vienna, Cheese, Atchaar, Lettuce', price_cents: 3000, category: 'Kota' },
      { name: 'Chips, Polony, Special, Vienna, Russian, Egg, Atchaar, Lettuce', price_cents: 3300, category: 'Kota' },
      { name: 'Chips, Polony, Special, Egg, Cheese, Vienna, Atchaar, Lettuce', price_cents: 3500, category: 'Kota' },
    ]
  },
  {
    title: 'Burger Sly Menu',
    items: [
      { name: 'Chips, Burger', price_cents: 1500, category: 'Burger Sly' },
      { name: 'Chips, Burger, Cheese', price_cents: 2000, category: 'Burger Sly' },
      { name: 'Chips, Burger, Vienna', price_cents: 2200, category: 'Burger Sly' },
      { name: 'Chips, Burger, Cheese, Vienna', price_cents: 2500, category: 'Burger Sly' },
      { name: 'Chips, Burger, Russian, Egg, Cheese', price_cents: 3000, category: 'Burger Sly' },
    ]
  },
  {
    title: 'Burger Kota Menu',
    items: [
      { name: 'Chips, Burger', price_cents: 1500, category: 'Burger Kota' },
      { name: 'Chips, Burger, Cheese', price_cents: 1800, category: 'Burger Kota' },
      { name: 'Chips, Burger, Vienna', price_cents: 2000, category: 'Burger Kota' },
      { name: 'Chips, Burger, Cheese, Vienna', price_cents: 2500, category: 'Burger Kota' },
      { name: 'Chips, Burger, Russian, Vienna', price_cents: 3000, category: 'Burger Kota' },
    ]
  }
];

@Component({
  selector: 'app-shop-page',
  imports: [FaIconComponent, FormsModule, StockBadgeComponent, PublicHeaderComponent, PublicFooterComponent, ErrorStateComponent, SkeletonComponent],
  templateUrl: './shop-page.component.html',
  styleUrl: './shop-page.component.scss'
})
export class ShopPageComponent {
  private readonly api = inject(ShopApi);
  private readonly route = inject(ActivatedRoute);
  private readonly title = inject(Title);
  private readonly toasts = inject(ToastService);

  protected readonly icons = icons;
  protected readonly money = formatMoney;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly hoursText = hoursText;
  protected readonly dayKeys = DAY_KEYS;
  protected readonly dayNames = DAY_NAMES;
  protected readonly menuSections = MENU_SECTIONS;

  protected readonly shop = signal<PublicShop | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly refreshFailed = signal(false);
  protected readonly refreshing = signal(false);
  protected readonly category = signal<string | null>(null);
  private readonly now = signal(Date.now());
  private readonly slug = this.route.snapshot.paramMap.get('slug') ?? '';

  // Order form state
  protected readonly cart = signal<Map<string, CartLine>>(new Map());
  protected readonly customerName = signal('');
  protected readonly customerPhone = signal('');
  protected readonly orderSubmitting = signal(false);
  protected readonly orderError = signal('');
  protected readonly placedOrder = signal<Order | null>(null);

  protected readonly cartSubtotal = computed(() => {
    let total = 0;
    for (const line of this.cart().values()) {
      total += line.item.price_cents * line.quantity;
    }
    return total;
  });
  protected readonly cartItemCount = computed(() => {
    let count = 0;
    for (const line of this.cart().values()) {
      count += line.quantity;
    }
    return count;
  });

  protected readonly products = computed(() => {
    const shop = this.shop();
    const category = this.category();
    return shop ? shop.products.filter((p) => !category || p.category === category) : [];
  });
  protected readonly updatedText = computed(() => {
    const shop = this.shop();
    return shop ? timeAgo(shop.updated_at, this.now()) : '';
  });
  protected readonly checkedText = computed(() => {
    const shop = this.shop();
    return shop ? timeAgo(shop.generated_at, this.now()) : '';
  });
  protected readonly counts = computed(() => {
    const list = this.shop()?.products ?? [];
    return {
      in: list.filter((p) => p.availability === 'in_stock').length,
      low: list.filter((p) => p.availability === 'low_stock').length,
      out: list.filter((p) => p.availability === 'out_of_stock').length
    };
  });

  constructor() {
    this.fetch(true);
    const poll = setInterval(() => {
      this.now.set(Date.now());
      if (document.visibilityState === 'visible') this.fetch(false);
    }, REFRESH_MS);
    // Coming back to the tab (or the phone waking up) refreshes straight away.
    const onVisible = () => {
      if (document.visibilityState === 'visible') this.fetch(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
    });
  }

  protected fetch(initial: boolean, fresh = false): void {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    this.api.publicShop(this.slug, fresh).subscribe({
      next: (shop) => {
        this.shop.set(shop);
        this.loading.set(false);
        this.refreshing.set(false);
        this.refreshFailed.set(false);
        this.notFound.set(false);
        this.now.set(Date.now());
        this.title.setTitle(`${shop.name} | Live availability`);
        if (this.category() && !shop.categories.includes(this.category()!)) this.category.set(null);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.refreshing.set(false);
        if (error instanceof HttpErrorResponse && error.status === 404) {
          this.notFound.set(true);
          this.shop.set(null);
        } else {
          this.refreshFailed.set(true);
        }
        if (initial) this.title.setTitle('Shop availability');
      }
    });
  }

  protected link(): string {
    return `${location.origin}/shop/${this.slug}`;
  }

  protected async copyUpdate(): Promise<void> {
    const shop = this.shop();
    if (!shop) return;
    const ok = await copyText(buildUpdateMessage(shop, this.link()));
    if (ok) this.toasts.success('Update message copied. Paste it into WhatsApp or an SMS.');
    else this.toasts.warning('Could not copy. Try again.');
  }

  protected async copyLink(): Promise<void> {
    if (await copyText(this.link())) this.toasts.success('Link copied.');
    else this.toasts.warning('Could not copy. Try again.');
  }

  // --- Order helpers ---
  protected cartQty(item: MenuEntry): number {
    return this.cart().get(item.name)?.quantity ?? 0;
  }

  protected increment(item: MenuEntry): void {
    this.cart.update((map) => {
      const next = new Map(map);
      const existing = next.get(item.name);
      if (existing) {
        next.set(item.name, { ...existing, quantity: existing.quantity + 1 });
      } else {
        next.set(item.name, { item, quantity: 1 });
      }
      return next;
    });
  }

  protected decrement(item: MenuEntry): void {
    this.cart.update((map) => {
      const next = new Map(map);
      const existing = next.get(item.name);
      if (!existing) return next;
      if (existing.quantity <= 1) {
        next.delete(item.name);
      } else {
        next.set(item.name, { ...existing, quantity: existing.quantity - 1 });
      }
      return next;
    });
  }

  protected placeOrder(): void {
    const name = this.customerName().trim();
    const phone = this.customerPhone().trim();
    this.orderError.set('');

    if (!name) { this.orderError.set('Please enter your name.'); return; }
    if (!phone) { this.orderError.set('Please enter your phone number.'); return; }
    if (this.cartItemCount() === 0) { this.orderError.set('Please add at least one item to your order.'); return; }

    const items: OrderItem[] = [];
    for (const line of this.cart().values()) {
      items.push({
        name: line.item.name,
        quantity: line.quantity,
        price_cents: line.item.price_cents,
        category: line.item.category
      });
    }

    this.orderSubmitting.set(true);
    this.api.placeOrder({ customer_name: name, customer_phone: phone, items }).subscribe({
      next: (order) => {
        this.orderSubmitting.set(false);
        this.placedOrder.set(order);
        this.cart.set(new Map());
      },
      error: (err: unknown) => {
        this.orderSubmitting.set(false);
        this.orderError.set(toFriendlyError(err, 'Could not place your order. Please try again.').message);
      }
    });
  }
}
