import { inject, Injectable, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Api, User } from './api';

@Injectable({ providedIn: 'root' })
export class Auth {
  private api = inject(Api);
  readonly user = signal<User | null>(null);
  private loaded = false;

  /** Restores the session from the cookie once per page load. */
  async load(): Promise<User | null> {
    if (!this.loaded) {
      this.loaded = true;
      try { this.user.set(await this.api.me()); } catch { this.user.set(null); }
    }
    return this.user();
  }

  async login(email: string, password: string): Promise<User> {
    const u = await this.api.login(email, password);
    this.user.set(u);
    this.loaded = true;
    return u;
  }

  async logout(): Promise<void> {
    await this.api.logout();
    this.user.set(null);
  }
}

// inject() only works synchronously in the injection context, so resolve both services before awaiting.
export const requireUser: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  const user = await auth.load();
  return user ? true : router.parseUrl('/login');
};

export const requireAdmin: CanActivateFn = async () => {
  const auth = inject(Auth);
  const router = inject(Router);
  const user = await auth.load();
  if (!user) return router.parseUrl('/login');
  return user.role === 'admin' ? true : router.parseUrl('/alerts');
};
