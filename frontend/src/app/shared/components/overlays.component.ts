import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ConfirmService } from '../../core/services/confirm.service';
import { ToastService } from '../../core/services/toast.service';
import { WakeService } from '../../core/services/wake.service';
import { icons } from '../icons';
import { ModalComponent } from './modal.component';

/** Toasts, the confirm dialog and the "server is waking up" banner. Mounted once in the root component. */
@Component({
  selector: 'app-overlays',
  imports: [FaIconComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (wake.waking()) {
      <div class="wake" role="status">
        <fa-icon [icon]="icons.wifi" aria-hidden="true" />
        <span>
          <strong>Waking up the demo server.</strong>
          Free hosting sleeps when it is idle, so the first request can take up to a minute. Everything will work
          once it is awake.
        </span>
      </div>
    }

    <div class="toasts" aria-live="polite" aria-atomic="false">
      @for (toast of toastService.toasts(); track toast.id) {
        <div class="toast" [class]="toast.kind" role="status">
          <fa-icon [icon]="toast.kind === 'error' ? icons.alert : toast.kind === 'warning' ? icons.warning : icons.ok" aria-hidden="true" />
          <span>{{ toast.message }}</span>
          <button type="button" class="icon-btn" aria-label="Dismiss message" (click)="toastService.dismiss(toast.id)">
            <fa-icon [icon]="icons.close" />
          </button>
        </div>
      }
    </div>

    <app-modal [open]="!!confirm.request()" [title]="confirm.request()?.title ?? ''" (closed)="confirm.answer(false)">
      <p class="muted" style="line-height: 1.6">{{ confirm.request()?.message }}</p>
      <div class="row" style="justify-content: flex-end; margin-top: 1.25rem">
        <button type="button" class="btn" (click)="confirm.answer(false)">Cancel</button>
        <button type="button" class="btn" [class.btn-danger]="confirm.request()?.danger" [class.btn-primary]="!confirm.request()?.danger" (click)="confirm.answer(true)">
          {{ confirm.request()?.confirmLabel ?? 'Confirm' }}
        </button>
      </div>
    </app-modal>
  `,
  styles: [
    `
      .wake { position: fixed; z-index: 60; left: 0.75rem; right: 0.75rem; top: 0.75rem; max-width: 560px; margin: 0 auto; display: flex; gap: 0.7rem; align-items: flex-start; padding: 0.8rem 1rem; border-radius: 12px; background: var(--warn-bg); color: var(--warn); border: 1px solid var(--warn-border); box-shadow: var(--shadow-lg); font-size: 0.88rem; line-height: 1.5; }
      .wake fa-icon { margin-top: 0.2rem; }
      .toasts { position: fixed; z-index: 70; right: 0.75rem; bottom: 0.75rem; left: 0.75rem; display: grid; gap: 0.5rem; justify-items: end; pointer-events: none; }
      .toast { pointer-events: auto; display: flex; align-items: center; gap: 0.6rem; max-width: min(100%, 440px); padding: 0.55rem 0.4rem 0.55rem 0.9rem; border-radius: 10px; color: #fff; font-size: 0.9rem; box-shadow: var(--shadow-lg); background: #1d4f8a; }
      .toast.success { background: #126f37; }
      .toast.warning { background: #9b5f00; }
      .toast.error { background: #a61b20; }
      .toast .icon-btn { color: #fff; width: 30px; height: 30px; }
      .toast .icon-btn:hover { background: rgba(255, 255, 255, 0.18); color: #fff; }
      @media (max-width: 720px) { .toasts { bottom: 4.9rem; } }
    `
  ]
})
export class OverlaysComponent {
  protected readonly wake = inject(WakeService);
  protected readonly toastService = inject(ToastService);
  protected readonly confirm = inject(ConfirmService);
  protected readonly icons = icons;
}
