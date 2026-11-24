import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { PublicShop, DAY_KEYS, DAY_NAMES } from '../../../core/models/api.models';
import { ShopApi } from '../../../core/services/shop-api.service';
import { ToastService } from '../../../core/services/toast.service';
import { copyText } from '../../../core/utils/clipboard';
import { formatMoney, hoursText, STATUS_LABEL, timeAgo } from '../../../core/utils/format';
import { buildUpdateMessage } from '../../../core/utils/messages';
import { PublicFooterComponent, PublicHeaderComponent } from '../../../shared/components/public-chrome.component';
import { ErrorStateComponent, SkeletonComponent } from '../../../shared/components/state.components';
import { StockBadgeComponent } from '../../../shared/components/stock-badge.component';
import { icons } from '../../../shared/icons';

const REFRESH_MS = 30_000;

@Component({
  selector: 'app-shop-page',
  imports: [FaIconComponent, StockBadgeComponent, PublicHeaderComponent, PublicFooterComponent, ErrorStateComponent, SkeletonComponent],
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

  protected readonly shop = signal<PublicShop | null>(null);
  protected readonly loading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly refreshFailed = signal(false);
  protected readonly refreshing = signal(false);
  protected readonly category = signal<string | null>(null);
  private readonly now = signal(Date.now());
  private readonly slug = this.route.snapshot.paramMap.get('slug') ?? '';

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
}
