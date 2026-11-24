import { Injectable, signal } from '@angular/core';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';
export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  info(message: string): void {
    this.show('info', message, 4000);
  }
  success(message: string): void {
    this.show('success', message, 3500);
  }
  warning(message: string): void {
    this.show('warning', message, 5000);
  }
  error(message: string): void {
    this.show('error', message, 6500);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((toast) => toast.id !== id));
  }

  private show(kind: ToastKind, message: string, durationMs: number): void {
    // The same message twice in a row is one toast, not two.
    if (this.toasts().some((toast) => toast.message === message)) return;
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, kind, message }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }
}
