import { Injectable, computed, signal } from '@angular/core';

/** Free hosting puts the API to sleep when nobody has used it for a while, and the first request after that
 *  can take about a minute. This tracks slow requests so the interface can say so, instead of looking broken. */
@Injectable({ providedIn: 'root' })
export class WakeService {
  private readonly slow = signal(0);
  readonly waking = computed(() => this.slow() > 0);

  begin(): void {
    this.slow.update((n) => n + 1);
  }

  end(): void {
    this.slow.update((n) => Math.max(0, n - 1));
  }
}
