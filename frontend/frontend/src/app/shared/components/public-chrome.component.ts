import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { environment } from '../../../environments/environment';
import { ThemeService } from '../../core/services/theme.service';
import { icons } from '../icons';
import { BrandMarkComponent } from './brand-mark.component';

@Component({
  selector: 'app-public-header',
  imports: [RouterLink, FaIconComponent, BrandMarkComponent],
  template: `
    <header class="pub-header">
      <a class="brand" routerLink="/" aria-label="Shopkeeper's Assistant home">
        <app-brand-mark [size]="32" />
        <span>Shopkeeper's Assistant</span>
      </a>
      <span class="spacer"></span>
      @if (showLinks()) {
        <nav class="links" aria-label="Site">
          <a [routerLink]="['/shop', slug]">Customer page</a>
        </nav>
      }
      <button type="button" class="icon-btn" (click)="theme.toggle()" [attr.aria-label]="theme.isDark() ? 'Switch to light mode' : 'Switch to dark mode'" [attr.aria-pressed]="theme.isDark()">
        <fa-icon [icon]="theme.isDark() ? icons.light : icons.dark" />
      </button>
      <a class="btn btn-sm btn-primary" routerLink="/login">Staff &amp; owner sign in</a>
    </header>
  `,
  styles: [
    `
      :host { display: block; position: sticky; top: 0; z-index: 20; }
      .pub-header { display: flex; align-items: center; gap: 0.5rem; height: 56px; padding: 0 clamp(0.75rem, 3vw, 1.5rem); background: var(--topbar); border-bottom: 1px solid var(--border); }
      .brand { display: inline-flex; align-items: center; gap: 0.6rem; color: var(--text-strong); text-decoration: none; font-weight: 700; font-size: 0.98rem; }
      .spacer { flex: 1; }
      .links { display: flex; gap: 0.2rem; margin-right: 0.4rem; }
      .links a { padding: 0.45rem 0.75rem; border-radius: 8px; color: var(--muted); text-decoration: none; font-size: 0.88rem; }
      .links a:hover { background: var(--surface-3); color: var(--text-strong); }
      @media (max-width: 720px) { .links { display: none; } .brand span { display: none; } }
      @media (max-width: 400px) { .btn-sm { padding: 0.3rem 0.5rem; } }
    `
  ]
})
export class PublicHeaderComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly icons = icons;
  protected readonly slug = environment.demoShopSlug;
  protected showLinks(): boolean {
    return true;
  }
}

@Component({
  selector: 'app-public-footer',
  imports: [RouterLink],
  template: `
    <footer class="pub-footer">
      <p><strong>Shopkeeper's Assistant</strong> · a prototype for township shops</p>
      <p>All shops, people and numbers on this site are fictional. It runs on free hosting, so the first load after a quiet spell can be slow.</p>
      <p><a routerLink="/login">Sign in</a></p>
    </footer>
  `,
  styles: [
    `
      .pub-footer { display: grid; gap: 0.4rem; justify-items: center; text-align: center; padding: 1.6rem 1rem 2rem; border-top: 1px solid var(--border); color: var(--muted); font-size: 0.84rem; background: var(--topbar); }
      p { max-width: 62ch; line-height: 1.6; }
    `
  ]
})
export class PublicFooterComponent {}
