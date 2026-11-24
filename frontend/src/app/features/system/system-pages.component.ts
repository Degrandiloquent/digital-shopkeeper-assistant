import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { BrandMarkComponent } from '../../shared/components/brand-mark.component';
import { icons } from '../../shared/icons';

@Component({
  selector: 'app-not-found',
  imports: [RouterLink, BrandMarkComponent],
  template: `
    <main id="main" class="full">
      <app-brand-mark [size]="48" />
      <h1>We could not find that page</h1>
      <p class="muted">The link may be old or mistyped. Customers can look up a shop from the link the owner shared.</p>
      <a class="btn btn-primary" routerLink="/">Go to the homepage</a>
    </main>
  `,
  styles: ['.full{min-height:100vh;display:grid;place-content:center;justify-items:center;gap:0.9rem;text-align:center;padding:2rem;} p{max-width:44ch;line-height:1.6}']
})
export class NotFoundComponent {}

@Component({
  selector: 'app-access-denied',
  imports: [RouterLink, FaIconComponent],
  template: `
    <section class="empty" style="padding-top: 4rem">
      <fa-icon [icon]="icons.warning" size="2x" aria-hidden="true" />
      <h3>This area is for the shop owner</h3>
      <p>Your account does not have access to this page. If you think it should, ask the owner.</p>
      <a class="btn" style="margin-top: 1rem" routerLink="/sell">Back to selling</a>
    </section>
  `
})
export class AccessDeniedComponent {
  protected readonly icons = icons;
}
