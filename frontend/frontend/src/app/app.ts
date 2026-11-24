import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './core/services/theme.service';
import { OverlaysComponent } from './shared/components/overlays.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, OverlaysComponent],
  template: `
    <a class="skip-link" href="#main">Skip to content</a>
    <router-outlet />
    <app-overlays />
  `
})
export class App {
  // Created eagerly so the saved theme is applied as soon as the app starts.
  private readonly theme = inject(ThemeService);
}
