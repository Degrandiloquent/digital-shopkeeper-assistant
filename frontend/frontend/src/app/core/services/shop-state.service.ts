import { Injectable, inject, signal } from '@angular/core';
import { Business } from '../models/api.models';
import { ShopApi } from './shop-api.service';

/** The shop's current record, shared by the top bar and the pages, so changing the status in one place shows
 *  up everywhere without a reload. */
@Injectable({ providedIn: 'root' })
export class ShopState {
  private readonly api = inject(ShopApi);
  readonly business = signal<Business | null>(null);

  load(): void {
    this.api.business().subscribe({ next: (business) => this.business.set(business), error: () => undefined });
  }

  set(business: Business): void {
    this.business.set(business);
  }

  clear(): void {
    this.business.set(null);
  }
}
