import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { AuthService } from '../../core/auth/auth.service';
import { Product, StockAdjustmentInput } from '../../core/models/api.models';
import { ConfirmService } from '../../core/services/confirm.service';
import { ShopApi } from '../../core/services/shop-api.service';
import { ToastService } from '../../core/services/toast.service';
import { centsToRands, formatMoney, randsToCents } from '../../core/utils/format';
import { toFriendlyError } from '../../core/utils/http-error.util';
import { ModalComponent } from '../../shared/components/modal.component';
import { EmptyStateComponent, ErrorStateComponent, SkeletonComponent } from '../../shared/components/state.components';
import { StockBadgeComponent } from '../../shared/components/stock-badge.component';
import { icons } from '../../shared/icons';

type Filter = 'all' | 'low' | 'out' | 'archived';
type AdjustMode = 'add' | 'remove' | 'correct';

@Component({
  selector: 'app-inventory',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    FaIconComponent,
    ModalComponent,
    StockBadgeComponent,
    ErrorStateComponent,
    EmptyStateComponent,
    SkeletonComponent
  ],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.scss'
})
export class InventoryComponent {
  private readonly api = inject(ShopApi);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  protected readonly icons = icons;
  protected readonly money = formatMoney;
  protected readonly canManage = computed(() => this.auth.can('products.manage'));

  protected readonly products = signal<Product[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadFailed = signal(false);
  protected readonly search = signal('');
  protected readonly category = signal('');
  protected readonly filter = signal<Filter>('all');

  protected readonly categories = computed(() => [...new Set(this.products().map((p) => p.category))].sort());
  protected readonly counts = computed(() => {
    const all = this.products();
    const active = all.filter((p) => p.is_active);
    return {
      all: active.length,
      low: active.filter((p) => p.stock_state === 'low_stock').length,
      out: active.filter((p) => p.stock_state === 'out_of_stock').length,
      archived: all.length - active.length
    };
  });

  protected readonly rows = computed(() => {
    const term = this.search().trim().toLowerCase();
    const category = this.category();
    const filter = this.filter();
    return this.products().filter((p) => {
      if (filter === 'archived' ? p.is_active : !p.is_active) return false;
      if (filter === 'low' && p.stock_state !== 'low_stock') return false;
      if (filter === 'out' && p.stock_state !== 'out_of_stock') return false;
      if (category && p.category !== category) return false;
      return !term || p.name.toLowerCase().includes(term);
    });
  });

  // ----- product form -----
  protected readonly productModal = signal<{ product: Product | null } | null>(null);
  protected readonly formError = signal('');
  protected readonly saving = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    category: ['', [Validators.required, Validators.maxLength(40)]],
    price: ['', [Validators.required]],
    stock_qty: [0, [Validators.required, Validators.min(0), Validators.max(100000)]],
    low_stock_threshold: [5, [Validators.required, Validators.min(0), Validators.max(100000)]],
    is_featured: [true]
  });

  // ----- stock adjustment -----
  protected readonly adjusting = signal<Product | null>(null);
  protected readonly adjustMode = signal<AdjustMode>('add');
  protected readonly adjustQty = signal<number | null>(null);
  protected readonly adjustNote = signal('');
  protected readonly adjustError = signal('');
  protected readonly adjustSaving = signal(false);

  protected readonly adjustDelta = computed(() => {
    const product = this.adjusting();
    const qty = this.adjustQty();
    if (!product || qty === null || !Number.isInteger(qty) || qty < 0) return null;
    switch (this.adjustMode()) {
      case 'add':
        return qty;
      case 'remove':
        return -qty;
      case 'correct':
        return qty - product.stock_qty;
    }
  });
  protected readonly adjustResult = computed(() => {
    const product = this.adjusting();
    const delta = this.adjustDelta();
    return product && delta !== null ? product.stock_qty + delta : null;
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    this.api.products({ includeArchived: this.canManage() }).subscribe({
      next: (products) => {
        this.products.set(products);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadFailed.set(true);
      }
    });
  }

  private replace(updated: Product): void {
    this.products.update((list) => list.map((p) => (p.id === updated.id ? updated : p)));
  }

  protected rowClass(product: Product): string {
    if (!product.is_active) return 'row-archived';
    return product.stock_state === 'out_of_stock' ? 'row-out' : product.stock_state === 'low_stock' ? 'row-low' : '';
  }

  // ----- product form -----
  protected openCreate(): void {
    this.form.reset({ name: '', category: this.category() || '', price: '', stock_qty: 0, low_stock_threshold: 5, is_featured: true });
    this.form.controls.stock_qty.enable();
    this.formError.set('');
    this.productModal.set({ product: null });
  }

  protected openEdit(product: Product): void {
    this.form.reset({
      name: product.name,
      category: product.category,
      price: centsToRands(product.price_cents),
      stock_qty: product.stock_qty,
      low_stock_threshold: product.low_stock_threshold,
      is_featured: product.is_featured
    });
    this.form.controls.stock_qty.disable(); // Stock changes go through "Adjust stock", which keeps a record.
    this.formError.set('');
    this.productModal.set({ product });
  }

  protected closeProductModal(): void {
    if (!this.saving()) this.productModal.set(null);
  }

  protected saveProduct(): void {
    const modal = this.productModal();
    if (!modal) return;
    this.formError.set('');
    const value = this.form.getRawValue();
    const cents = randsToCents(value.price);
    if (this.form.invalid || cents === null) {
      this.form.markAllAsTouched();
      if (cents === null) this.form.controls.price.setErrors({ invalidPrice: true });
      return;
    }
    this.saving.set(true);
    const common = {
      name: value.name.trim(),
      category: value.category.trim(),
      price_cents: cents,
      low_stock_threshold: value.low_stock_threshold,
      is_featured: value.is_featured
    };
    const request$ = modal.product
      ? this.api.updateProduct(modal.product.id, common)
      : this.api.createProduct({ ...common, stock_qty: value.stock_qty });

    request$.subscribe({
      next: (saved) => {
        this.saving.set(false);
        if (modal.product) this.replace(saved);
        else this.products.update((list) => [...list, saved]);
        this.productModal.set(null);
        this.toasts.success(modal.product ? `Saved changes to ${saved.name}.` : `Added ${saved.name}.`);
      },
      error: (error) => {
        this.saving.set(false);
        this.formError.set(toFriendlyError(error, 'The product was not saved. Try again.').message);
      }
    });
  }

  protected async toggleArchive(product: Product): Promise<void> {
    if (product.is_active) {
      const ok = await this.confirm.ask({
        title: `Archive ${product.name}?`,
        message: 'It disappears from the sales screen and the customer page. Sales history stays, and you can restore it any time.',
        confirmLabel: 'Archive product',
        danger: true
      });
      if (!ok) return;
    }
    const request$ = product.is_active ? this.api.archiveProduct(product.id) : this.api.restoreProduct(product.id);
    request$.subscribe({
      next: (updated) => {
        this.replace(updated);
        this.toasts.success(updated.is_active ? `Restored ${updated.name}.` : `Archived ${updated.name}.`);
      }
    });
  }

  // ----- stock adjustment -----
  protected openAdjust(product: Product): void {
    this.adjusting.set(product);
    this.adjustMode.set('add');
    this.adjustQty.set(null);
    this.adjustNote.set('');
    this.adjustError.set('');
  }

  protected setMode(mode: AdjustMode): void {
    this.adjustMode.set(mode);
    this.adjustQty.set(mode === 'correct' ? (this.adjusting()?.stock_qty ?? 0) : null);
    this.adjustError.set('');
  }

  protected saveAdjust(): void {
    const product = this.adjusting();
    const delta = this.adjustDelta();
    if (!product || delta === null) return;
    if (delta === 0) {
      this.adjustError.set('That is the same as the current count, so nothing would change.');
      return;
    }
    if (this.adjustResult()! < 0) {
      this.adjustError.set(`You only have ${product.stock_qty} in stock, so you cannot remove more than that.`);
      return;
    }
    const input: StockAdjustmentInput = {
      delta,
      reason: this.adjustMode() === 'add' ? 'restock' : this.adjustMode() === 'remove' ? 'damaged' : 'correction',
      note: this.adjustNote().trim() || null
    };
    this.adjustSaving.set(true);
    this.api.adjustStock(product.id, input).subscribe({
      next: (updated) => {
        this.adjustSaving.set(false);
        this.replace(updated);
        this.adjusting.set(null);
        this.toasts.success(`${updated.name} now has ${updated.stock_qty} in stock.`);
      },
      error: (error) => {
        this.adjustSaving.set(false);
        this.adjustError.set(toFriendlyError(error).message);
      }
    });
  }
}
