import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { icons } from '../icons';

@Component({
  selector: 'app-empty-state',
  imports: [FaIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="empty">
      <fa-icon [icon]="icon()" size="2x" aria-hidden="true" />
      <h3>{{ title() }}</h3>
      <p>{{ message() }}</p>
      <ng-content />
    </section>
  `
})
export class EmptyStateComponent {
  readonly icon = input<IconDefinition>(icons.product);
  readonly title = input('Nothing here yet');
  readonly message = input('');
}

@Component({
  selector: 'app-error-state',
  imports: [FaIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="empty" role="alert">
      <fa-icon [icon]="icons.warning" size="2x" aria-hidden="true" />
      <h3>{{ title() }}</h3>
      <p>{{ message() }}</p>
      <button type="button" class="btn btn-sm" style="margin-top: 0.9rem" (click)="retry.emit()">
        <fa-icon [icon]="icons.refresh" /> Try again
      </button>
    </section>
  `
})
export class ErrorStateComponent {
  readonly title = input("We couldn't load this");
  readonly message = input('Check your connection and try again.');
  readonly retry = output<void>();
  protected readonly icons = icons;
}

@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stack" aria-hidden="true">
      @for (row of rows(); track row) {
        <div class="skeleton" [style.height.px]="height()"></div>
      }
    </div>
    <span class="sr-only" role="status">Loading</span>
  `
})
export class SkeletonComponent {
  readonly count = input(3);
  readonly height = input(56);
  protected rows(): number[] {
    return Array.from({ length: this.count() }, (_, i) => i);
  }
}
