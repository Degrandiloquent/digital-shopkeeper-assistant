import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { AuthService } from '../core/auth/auth.service';
import { Permission } from '../core/models/api.models';
import { ShopState } from '../core/services/shop-state.service';
import { ThemeService } from '../core/services/theme.service';
import { BrandMarkComponent } from '../shared/components/brand-mark.component';
import { StatusPillComponent } from '../shared/components/status-pill.component';
import { icons } from '../shared/icons';

interface NavItem {
  route: string;
  label: string;
  icon: IconDefinition;
  permission: Permission;
  /** Secondary items sit in the account menu on phones so the bottom bar keeps five tabs. */
  secondary?: boolean;
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FaIconComponent, BrandMarkComponent, StatusPillComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss'
})
export class AppShellComponent {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  protected readonly shop = inject(ShopState);
  private readonly router = inject(Router);
  protected readonly icons = icons;
  protected readonly menuOpen = signal(false);

  private readonly allItems = computed<NavItem[]>(() => {
    const owner = this.auth.isOwner();
    return [
      { route: '/dashboard', label: 'Dashboard', icon: icons.chart, permission: 'dashboard.view' },
      { route: '/sell', label: 'Sell', icon: icons.sell, permission: 'sales.create' },
      { route: '/orders', label: 'Orders', icon: icons.receipt, permission: 'dashboard.view' },
      { route: '/inventory', label: owner ? 'Inventory' : 'Stock', icon: icons.inventory, permission: 'products.view' },
      { route: '/sales', label: owner ? 'Sales' : 'My sales', icon: icons.history, permission: 'sales.view_own' },
      { route: '/shop', label: 'Shop page', icon: icons.store, permission: 'business.manage', secondary: true },
      { route: '/activity', label: 'Activity', icon: icons.clock, permission: 'activity.view', secondary: true }
    ];
  });

  protected readonly navItems = computed(() => this.allItems().filter((item) => this.auth.can(item.permission)));
  protected readonly tabItems = computed(() => this.navItems().filter((item) => !item.secondary));
  protected readonly secondaryItems = computed(() => this.navItems().filter((item) => item.secondary));
  protected readonly publicLink = computed(() => `/shop/${this.auth.business()?.slug ?? ''}`);

  constructor() {
    this.shop.load();
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  @HostListener('document:keydown.escape')
  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (this.menuOpen() && !(event.target as HTMLElement).closest('.account')) this.menuOpen.set(false);
  }

  protected signOut(): void {
    this.menuOpen.set(false);
    this.auth.logout().subscribe(() => this.shop.clear());
  }

  protected go(route: string): void {
    this.menuOpen.set(false);
    this.router.navigateByUrl(route);
  }
}
