import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** The logo: a shopfront with a tick, on the same dark rounded tile as the CyberShield mark. */
@Component({
  selector: 'app-brand-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="bm-bg" x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#0f213f" />
          <stop offset="1" stop-color="#070f20" />
        </linearGradient>
        <linearGradient id="bm-accent" x1="12" y1="12" x2="52" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#65d8ff" />
          <stop offset="1" stop-color="#27c59a" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#bm-bg)" />
      <path
        d="M13 24 18 13h28l5 11c0 3.6-2.9 6.4-6.4 6.4-2.7 0-5-1.6-6-3.9-1 2.3-3.3 3.9-6 3.9s-5-1.6-6-3.9c-1 2.3-3.3 3.9-6 3.9C15.9 30.4 13 27.6 13 24Z"
        fill="none" stroke="url(#bm-accent)" stroke-width="3.2" stroke-linejoin="round" />
      <path d="M17 31v18h30V31" fill="none" stroke="#7ee8ff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
      <path d="m26.5 41 4.2 4.2 7.8-8" fill="none" stroke="#2bd0a5" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `,
  styles: [':host{display:inline-flex;line-height:0}svg{border-radius:9px}']
})
export class BrandMarkComponent {
  readonly size = input(32);
}
