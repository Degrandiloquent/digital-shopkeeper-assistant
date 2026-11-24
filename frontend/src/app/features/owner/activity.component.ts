import { Component, inject, signal } from '@angular/core';
import { ActivityItem } from '../../core/models/api.models';
import { ShopApi } from '../../core/services/shop-api.service';
import { formatDateTime } from '../../core/utils/format';
import { EmptyStateComponent, ErrorStateComponent, SkeletonComponent } from '../../shared/components/state.components';

@Component({
  selector: 'app-activity',
  imports: [EmptyStateComponent, ErrorStateComponent, SkeletonComponent],
  template: `
    <div class="page">
      <div class="page-heading">
        <div>
          <h1>Activity</h1>
          <p>A record of who changed what: sign-ins, stock changes, status updates and announcements.</p>
        </div>
      </div>
      <section class="card flush">
        @if (loading()) {
          <div style="padding: 1rem"><app-skeleton [count]="6" [height]="44" /></div>
        } @else if (failed()) {
          <app-error-state message="We could not load the activity record." (retry)="load()" />
        } @else if (items().length === 0) {
          <app-empty-state title="No activity yet" message="Changes will be listed here." />
        } @else {
          <div class="table-wrap">
            <table class="data stack-mobile">
              <thead><tr><th>When</th><th>Who</th><th>What happened</th></tr></thead>
              <tbody>
                @for (item of items(); track item.id) {
                  <tr>
                    <td data-label="When" class="nowrap">{{ when(item.created_at) }}</td>
                    <td data-label="Who">{{ item.actor_name || 'System' }}</td>
                    <td data-label="What">{{ item.summary }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>
  `
})
export class ActivityComponent {
  private readonly api = inject(ShopApi);
  protected readonly items = signal<ActivityItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly when = (iso: string) => formatDateTime(iso);

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.api.activity().subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      }
    });
  }
}
