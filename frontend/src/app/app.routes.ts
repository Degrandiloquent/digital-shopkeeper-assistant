import { Routes } from '@angular/router';
import { authGuard, guestGuard, permissionGuard } from './core/guards/guards';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: "Shopkeeper's Assistant",
    loadComponent: () => import('./features/public/home/home.component').then((m) => m.HomeComponent)
  },
  {
    // The customer page. No sign-in: it is meant to be shared in a window poster, a QR code or a WhatsApp group.
    path: 'shop/:slug',
    loadComponent: () => import('./features/public/shop/shop-page.component').then((m) => m.ShopPageComponent)
  },
  {
    path: 'login',
    title: 'Sign in',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layouts/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      {
        path: 'dashboard',
        title: 'Dashboard',
        canActivate: [permissionGuard],
        data: { permission: 'dashboard.view' },
        loadComponent: () => import('./features/owner/dashboard.component').then((m) => m.DashboardComponent)
      },
      {
        path: 'sell',
        title: 'Record a sale',
        canActivate: [permissionGuard],
        data: { permission: 'sales.create' },
        loadComponent: () => import('./features/staff/sell.component').then((m) => m.SellComponent)
      },
      {
        path: 'inventory',
        title: 'Stock',
        canActivate: [permissionGuard],
        data: { permission: 'products.view' },
        loadComponent: () => import('./features/owner/inventory.component').then((m) => m.InventoryComponent)
      },
      {
        path: 'sales',
        title: 'Sales',
        canActivate: [permissionGuard],
        data: { permission: 'sales.view_own' },
        loadComponent: () => import('./features/shared/sales-history.component').then((m) => m.SalesHistoryComponent)
      },
      {
        path: 'shop',
        title: 'Shop page',
        canActivate: [permissionGuard],
        data: { permission: 'business.manage' },
        loadComponent: () => import('./features/owner/shop-settings.component').then((m) => m.ShopSettingsComponent)
      },
      {
        path: 'activity',
        title: 'Activity',
        canActivate: [permissionGuard],
        data: { permission: 'activity.view' },
        loadComponent: () => import('./features/owner/activity.component').then((m) => m.ActivityComponent)
      },
      {
        path: 'access-denied',
        title: 'Access denied',
        loadComponent: () => import('./features/system/system-pages.component').then((m) => m.AccessDeniedComponent)
      }
    ]
  },
  {
    path: '**',
    title: 'Page not found',
    loadComponent: () => import('./features/system/system-pages.component').then((m) => m.NotFoundComponent)
  }
];
