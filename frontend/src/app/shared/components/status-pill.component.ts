import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ShopStatus } from '../../core/models/api.models';
import { STATUS_LABEL } from '../../core/utils/format';
import { icons } from '../icons';

@Component({
  selector: 'app-status-pill',
  imports: [FaIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="status()"><fa-icon [icon]="icon()" aria-hidden="true" />{{ label() }}</span>`
})
export class StatusPillComponent {
  readonly status = input.required<ShopStatus>();
  protected readonly label = computed(() => STATUS_LABEL[this.status()]);
  protected readonly icon = computed(() =>
    this.status() === 'open' ? icons.ok : this.status() === 'closed' ? icons.alert : icons.warning
  );
}
