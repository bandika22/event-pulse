import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth } from './auth';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="topbar">
      <span class="brand">Event Pulse</span>
      @if (auth.user(); as u) {
        <nav>
          <a routerLink="/alerts" routerLinkActive="active">My alerts</a>
          @if (u.role === 'admin') { <a routerLink="/admin" routerLinkActive="active">Admin</a> }
        </nav>
        <span class="who">{{ u.email }} <button class="link" (click)="logout()">Log out</button></span>
      }
    </header>
    <main><router-outlet /></main>
  `,
})
export class App {
  protected auth = inject(Auth);
  private router = inject(Router);

  async logout() {
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
