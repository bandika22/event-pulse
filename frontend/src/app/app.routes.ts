import { Routes } from '@angular/router';
import { requireAdmin, requireUser } from './auth';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/login').then((m) => m.LoginPage) },
  { path: 'alerts', canActivate: [requireUser], loadComponent: () => import('./pages/my-alerts').then((m) => m.MyAlertsPage) },
  { path: 'admin', canActivate: [requireAdmin], loadComponent: () => import('./pages/admin').then((m) => m.AdminPage) },
  { path: '', pathMatch: 'full', redirectTo: 'alerts' },
  { path: '**', redirectTo: 'alerts' },
];
