import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { errorMessage } from '../api';
import { Auth } from '../auth';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <section class="card narrow">
      <h1>Log in</h1>
      <form (ngSubmit)="submit()">
        <label>Email <input name="email" type="email" [(ngModel)]="email" required autocomplete="username" /></label>
        <label>Password <input name="password" type="password" [(ngModel)]="password" required autocomplete="current-password" /></label>
        @if (error()) { <p class="error">{{ error() }}</p> }
        <button type="submit" [disabled]="busy()">Log in</button>
      </form>
      <div class="dev-note">
        <strong>Local development only.</strong> These demo accounts are seeded automatically on first start and listed here
        for convenience. This isn't how a production deployment would handle accounts (see README).
        <p>User: <code>alice&#64;example.com</code> / <code>alice123</code><br />Admin: <code>admin&#64;example.com</code> / <code>admin123</code></p>
      </div>
    </section>
  `,
})
export class LoginPage {
  private auth = inject(Auth);
  private router = inject(Router);
  email = '';
  password = '';
  error = signal('');
  busy = signal(false);

  async submit() {
    this.busy.set(true);
    this.error.set('');
    try {
      const user = await this.auth.login(this.email, this.password);
      await this.router.navigateByUrl(user.role === 'admin' ? '/admin' : '/alerts');
    } catch (err) {
      this.error.set(errorMessage(err));
    } finally {
      this.busy.set(false);
    }
  }
}
