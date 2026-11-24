import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private static readonly STORAGE_KEY = 'shopkeeper.theme';
  private static readonly DARK_CLASS = 'theme-dark';

  private readonly doc = inject(DOCUMENT);
  private readonly mode = signal<ThemeMode>(this.readInitialMode());

  readonly theme = this.mode.asReadonly();
  readonly isDark = computed(() => this.mode() === 'dark');

  constructor() {
    effect(() => this.doc.body?.classList.toggle(ThemeService.DARK_CLASS, this.mode() === 'dark'));
  }

  setTheme(mode: ThemeMode): void {
    this.mode.set(mode);
    try {
      localStorage.setItem(ThemeService.STORAGE_KEY, mode);
    } catch {
      // Storage can be blocked (private mode). The theme still applies for this visit.
    }
  }

  toggle(): void {
    this.setTheme(this.isDark() ? 'light' : 'dark');
  }

  private readInitialMode(): ThemeMode {
    try {
      return localStorage.getItem(ThemeService.STORAGE_KEY) === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  }
}
