import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { environment } from '../../../../environments/environment';
import { ShopStatus, StockState } from '../../../core/models/api.models';
import { formatMoney, STATUS_LABEL, STOCK_LABEL } from '../../../core/utils/format';
import { PublicFooterComponent, PublicHeaderComponent } from '../../../shared/components/public-chrome.component';
import { icons } from '../../../shared/icons';

interface DemoItem {
  name: string;
  price: number;
  stock: number;
  threshold: number;
}

const START: DemoItem[] = [
  { name: 'White bread (700g)', price: 1899, stock: 9, threshold: 4 },
  { name: 'Fresh milk (1L)', price: 2549, stock: 5, threshold: 3 },
  { name: 'Maize meal (5kg)', price: 6999, stock: 12, threshold: 4 },
  { name: 'Cooking oil (750ml)', price: 4799, stock: 2, threshold: 2 }
];

@Component({
  selector: 'app-home',
  imports: [RouterLink, FaIconComponent, PublicHeaderComponent, PublicFooterComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  protected readonly icons = icons;
  protected readonly money = formatMoney;
  protected readonly shopSlug = environment.demoShopSlug;
  protected readonly stockLabel = STOCK_LABEL;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statuses: ShopStatus[] = ['open', 'closed', 'temporarily_unavailable'];

  // The hero demo runs entirely in the browser with sample numbers. It is not connected to the server.
  protected readonly items = signal<DemoItem[]>(START.map((i) => ({ ...i })));
  protected readonly status = signal<ShopStatus>('open');
  protected readonly lastSale = signal('');
  protected readonly soldTotal = computed(() =>
    START.reduce((sum, start, i) => sum + (start.stock - this.items()[i].stock) * start.price, 0)
  );

  protected state(item: DemoItem): StockState {
    return item.stock <= 0 ? 'out_of_stock' : item.stock <= item.threshold ? 'low_stock' : 'in_stock';
  }

  protected sell(index: number): void {
    const item = this.items()[index];
    if (item.stock <= 0) return;
    this.items.update((list) => list.map((x, i) => (i === index ? { ...x, stock: x.stock - 1 } : x)));
    this.lastSale.set(`Sold 1 × ${item.name}. Stock is now ${item.stock - 1}.`);
  }

  protected reset(): void {
    this.items.set(START.map((i) => ({ ...i })));
    this.status.set('open');
    this.lastSale.set('');
  }
}
