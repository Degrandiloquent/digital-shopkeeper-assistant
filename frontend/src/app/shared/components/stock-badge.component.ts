import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { StockState } from '../../core/models/api.models';
import { STOCK_LABEL } from '../../core/utils/format';
import { icons } from '../icons';

/** Always an icon plus words, never colour alone, so the state is clear to everyone. */
@Component({
  selector: 'app-stock-badge',
  imports: [FaIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="state()"><fa-icon [icon]="icon()" aria-hidden="true" />{{ label() }}</span>`
})
export class StockBadgeComponent {
  readonly state = input.required<StockState>();
  protected readonly label = computed(() => STOCK_LABEL[this.state()]);
  protected readonly icon = computed(() =>
    this.state() === 'in_stock' ? icons.ok : this.state() === 'low_stock' ? icons.warning : icons.alert
  );
}
