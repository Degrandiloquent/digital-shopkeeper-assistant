import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

@Component({
  selector: 'app-metric-card',
  imports: [FaIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card metric" [class]="tone()">
      <div class="meta">
        <span class="label">{{ label() }}</span>
        <span class="icon-badge" aria-hidden="true"><fa-icon [icon]="icon()" /></span>
      </div>
      <strong class="num">{{ value() }}</strong>
      @if (supporting()) {
        <small class="supporting">{{ supporting() }}</small>
      }
    </article>
  `,
  styles: [
    `
      .metric { min-height: 108px; padding: 0.85rem 0.95rem; }
      .meta { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
      .label { color: var(--muted); font-size: 0.82rem; font-weight: 600; }
      .icon-badge { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 8px; background: var(--accent-soft); color: var(--accent-text); font-size: 0.85rem; flex: 0 0 auto; }
      strong { display: block; font-size: 1.85rem; margin-top: 0.4rem; line-height: 1.1; color: var(--text-strong); }
      .supporting { display: block; margin-top: 0.25rem; color: var(--muted); font-size: 0.78rem; }
      .healthy .icon-badge { background: var(--ok-bg); color: var(--ok); }
      .warning .icon-badge { background: var(--warn-bg); color: var(--warn); }
      .critical .icon-badge { background: var(--danger-bg); color: var(--danger); }
    `
  ]
})
export class MetricCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input.required<IconDefinition>();
  readonly supporting = input('');
  readonly tone = input<'primary' | 'healthy' | 'warning' | 'critical'>('primary');
}
