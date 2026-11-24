import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { AuthService } from '../../core/auth/auth.service';
import {
  Announcement,
  AnnouncementTone,
  Business,
  DAY_KEYS,
  DAY_NAMES,
  DayKey,
  OpeningHours,
  PublicShop,
  ShopStatus
} from '../../core/models/api.models';
import { ConfirmService } from '../../core/services/confirm.service';
import { ShopApi } from '../../core/services/shop-api.service';
import { ShopState } from '../../core/services/shop-state.service';
import { ToastService } from '../../core/services/toast.service';
import { copyText } from '../../core/utils/clipboard';
import { formatDateTime, STATUS_LABEL } from '../../core/utils/format';
import { toFriendlyError } from '../../core/utils/http-error.util';
import { buildUpdateMessage } from '../../core/utils/messages';
import { ErrorStateComponent, SkeletonComponent } from '../../shared/components/state.components';
import { StatusPillComponent } from '../../shared/components/status-pill.component';
import { icons } from '../../shared/icons';

const STATUS_OPTIONS: { value: ShopStatus; title: string; hint: string; icon: keyof typeof icons }[] = [
  { value: 'open', title: 'Open', hint: 'Customers can come in.', icon: 'ok' },
  { value: 'closed', title: 'Closed', hint: 'Shut for now, outside trading hours.', icon: 'alert' },
  { value: 'temporarily_unavailable', title: 'Temporarily unavailable', hint: 'Power cut, restocking, back soon.', icon: 'warning' }
];

const DURATIONS = [
  { label: '1 day', hours: 24 },
  { label: '3 days', hours: 72 },
  { label: '7 days', hours: 168 },
  { label: 'Until I end it', hours: 0 }
];

@Component({
  selector: 'app-shop-settings',
  imports: [FormsModule, ReactiveFormsModule, FaIconComponent, StatusPillComponent, ErrorStateComponent, SkeletonComponent],
  templateUrl: './shop-settings.component.html',
  styleUrl: './shop-settings.component.scss'
})
export class ShopSettingsComponent {
  private readonly api = inject(ShopApi);
  private readonly auth = inject(AuthService);
  private readonly shopState = inject(ShopState);
  private readonly toasts = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly fb = inject(FormBuilder);

  protected readonly icons = icons;
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly durations = DURATIONS;
  protected readonly dayKeys = DAY_KEYS;
  protected readonly dayNames = DAY_NAMES;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly when = (iso: string) => formatDateTime(iso);

  protected readonly business = signal<Business | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  // status
  protected readonly status = signal<ShopStatus>('open');
  protected readonly statusMessage = signal('');
  protected readonly statusSaving = signal(false);
  protected readonly statusError = signal('');
  protected readonly statusDirty = computed(() => {
    const b = this.business();
    return !!b && (b.status !== this.status() || (b.status_message ?? '') !== this.statusMessage().trim());
  });

  // announcements
  protected readonly announcements = signal<Announcement[]>([]);
  protected readonly announceForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(80)]],
    body: ['', [Validators.maxLength(280)]],
    tone: ['info' as AnnouncementTone],
    durationHours: [24]
  });
  protected readonly announceSaving = signal(false);
  protected readonly announceError = signal('');

  // shop details + hours
  protected readonly detailsForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    area_label: ['', [Validators.required, Validators.maxLength(120)]],
    contact_note: ['', [Validators.maxLength(140)]]
  });
  protected readonly detailsSaving = signal(false);
  protected readonly detailsError = signal('');
  protected readonly hours = signal<OpeningHours | null>(null);
  protected readonly hoursSaving = signal(false);
  protected readonly hoursError = signal('');

  // sharing
  protected readonly publicLink = computed(() => `${location.origin}/shop/${this.auth.business()?.slug ?? ''}`);
  protected readonly qrDataUrl = signal('');
  protected readonly preview = signal<PublicShop | null>(null);
  protected readonly message = computed(() => {
    const shop = this.preview();
    return shop ? buildUpdateMessage(shop, this.publicLink()) : '';
  });

  constructor() {
    this.load();
    this.loadPreview();
    this.makeQr();
  }

  protected load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.api.business().subscribe({
      next: (business) => {
        this.applyBusiness(business);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      }
    });
    this.api.announcements().subscribe({ next: (list) => this.announcements.set(list), error: () => undefined });
  }

  private applyBusiness(business: Business): void {
    this.business.set(business);
    this.shopState.set(business);
    this.status.set(business.status);
    this.statusMessage.set(business.status_message ?? '');
    this.hours.set(JSON.parse(JSON.stringify(business.hours)) as OpeningHours);
    this.detailsForm.reset({ name: business.name, area_label: business.area_label, contact_note: business.contact_note ?? '' });
  }

  protected loadPreview(): void {
    const slug = this.auth.business()?.slug;
    if (!slug) return;
    this.api.publicShop(slug, true).subscribe({ next: (shop) => this.preview.set(shop), error: () => undefined });
  }

  private async makeQr(): Promise<void> {
    try {
      // Loaded on demand, so the QR library is only downloaded on this page.
      const mod = await import('qrcode');
      const lib = (mod as unknown as { default?: typeof mod }).default ?? mod;
      this.qrDataUrl.set(await lib.toDataURL(this.publicLink(), { margin: 1, width: 240, errorCorrectionLevel: 'M' }));
    } catch {
      this.qrDataUrl.set('');
    }
  }

  // ----- status -----
  protected saveStatus(): void {
    this.statusSaving.set(true);
    this.statusError.set('');
    this.api.updateStatus(this.status(), this.statusMessage().trim() || null).subscribe({
      next: (business) => {
        this.statusSaving.set(false);
        this.applyBusiness(business);
        this.loadPreview();
        this.toasts.success(`Shop set to ${STATUS_LABEL[business.status]}. Customers see it now.`);
      },
      error: (error) => {
        this.statusSaving.set(false);
        this.statusError.set(toFriendlyError(error).message);
      }
    });
  }

  // ----- announcements -----
  protected publish(): void {
    this.announceError.set('');
    if (this.announceForm.invalid) {
      this.announceForm.markAllAsTouched();
      return;
    }
    const value = this.announceForm.getRawValue();
    const expires = value.durationHours > 0 ? new Date(Date.now() + value.durationHours * 3600_000).toISOString() : null;
    this.announceSaving.set(true);
    this.api.createAnnouncement({ title: value.title.trim(), body: value.body.trim(), tone: value.tone, expires_at: expires }).subscribe({
      next: (created) => {
        this.announceSaving.set(false);
        this.announcements.update((list) => [created, ...list]);
        this.announceForm.reset({ title: '', body: '', tone: 'info', durationHours: 24 });
        this.loadPreview();
        this.toasts.success('Announcement published on your customer page.');
      },
      error: (error) => {
        this.announceSaving.set(false);
        this.announceError.set(toFriendlyError(error).message);
      }
    });
  }

  protected async endAnnouncement(item: Announcement): Promise<void> {
    const ok = await this.confirm.ask({
      title: 'End this announcement?',
      message: `“${item.title}” will disappear from your customer page straight away.`,
      confirmLabel: 'End announcement',
      danger: true
    });
    if (!ok) return;
    this.api.endAnnouncement(item.id).subscribe({
      next: (ended) => {
        this.announcements.update((list) => list.map((a) => (a.id === ended.id ? ended : a)));
        this.loadPreview();
        this.toasts.success('Announcement ended.');
      }
    });
  }

  protected stateBadge(state: Announcement['state']): string {
    return state === 'live' ? 'ok' : state === 'scheduled' ? 'info' : 'neutral';
  }

  // ----- details & hours -----
  protected saveDetails(): void {
    if (this.detailsForm.invalid) {
      this.detailsForm.markAllAsTouched();
      return;
    }
    const value = this.detailsForm.getRawValue();
    this.detailsSaving.set(true);
    this.detailsError.set('');
    this.api.updateProfile({ name: value.name.trim(), area_label: value.area_label.trim(), contact_note: value.contact_note.trim() || null }).subscribe({
      next: (business) => {
        this.detailsSaving.set(false);
        this.applyBusiness(business);
        this.loadPreview();
        this.toasts.success('Shop details saved.');
      },
      error: (error) => {
        this.detailsSaving.set(false);
        this.detailsError.set(toFriendlyError(error).message);
      }
    });
  }

  protected setDay(key: DayKey, patch: Partial<{ closed: boolean; open: string; close: string }>): void {
    this.hours.update((current) => {
      if (!current) return current;
      const day = { ...current[key], ...patch };
      if (patch.closed === false) {
        day.open = day.open ?? '07:00';
        day.close = day.close ?? '19:00';
      }
      return { ...current, [key]: day };
    });
  }

  protected copyToAll(from: DayKey): void {
    this.hours.update((current) => {
      if (!current) return current;
      const next = { ...current };
      for (const key of DAY_KEYS) next[key] = { ...current[from] };
      return next;
    });
  }

  protected saveHours(): void {
    const hours = this.hours();
    if (!hours) return;
    this.hoursSaving.set(true);
    this.hoursError.set('');
    this.api.updateProfile({ hours }).subscribe({
      next: (business) => {
        this.hoursSaving.set(false);
        this.applyBusiness(business);
        this.loadPreview();
        this.toasts.success('Opening hours saved.');
      },
      error: (error) => {
        this.hoursSaving.set(false);
        this.hoursError.set(toFriendlyError(error).message);
      }
    });
  }

  // ----- sharing -----
  protected async copy(text: string, what: string): Promise<void> {
    if (await copyText(text)) this.toasts.success(`${what} copied.`);
    else this.toasts.warning('Could not copy. Select the text and copy it by hand.');
  }
}
