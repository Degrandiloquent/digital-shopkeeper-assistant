import { ChangeDetectionStrategy, Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { icons } from '../icons';

/** A dialog built on the browser's own <dialog>: focus is trapped, Escape closes it and the page behind is
 *  inert, with no library. Content goes inside; `closed` fires on Escape, the X button or a backdrop click. */
@Component({
  selector: 'app-modal',
  imports: [FaIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog #dlg class="modal" [attr.aria-labelledby]="'modal-title'" (cancel)="onCancel($event)" (click)="onBackdrop($event)">
      @if (open()) {
        <div class="modal-body">
          <header>
            <h2 id="modal-title">{{ title() }}</h2>
            <button type="button" class="icon-btn" aria-label="Close" (click)="closed.emit()">
              <fa-icon [icon]="icons.close" />
            </button>
          </header>
          <div class="content"><ng-content /></div>
        </div>
      }
    </dialog>
  `,
  styles: [
    `
      .modal-body { display: flex; flex-direction: column; max-height: calc(100dvh - 2rem); }
      header { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.9rem 1rem 0.5rem 1.25rem; }
      header h2 { font-size: 1.1rem; }
      .content { padding: 0.25rem 1.25rem 1.25rem; overflow-y: auto; }
    `
  ]
})
export class ModalComponent {
  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly closed = output<void>();
  protected readonly icons = icons;

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;
      if (this.open() && !element.open) {
        element.showModal();
      } else if (!this.open() && element.open) {
        element.close();
      }
    });
  }

  protected onCancel(event: Event): void {
    event.preventDefault(); // Let the parent decide, so state and dialog never disagree.
    this.closed.emit();
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.closed.emit();
  }
}
