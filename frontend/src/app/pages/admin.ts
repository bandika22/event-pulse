import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminUser, Alert, Api, Delivery, errorMessage, EventRow, SourceStatus } from '../api';

type Tab = 'deliveries' | 'events' | 'alerts' | 'sources';

@Component({
  selector: 'app-admin',
  imports: [FormsModule, DatePipe],
  template: `
    <div class="toolbar">
      <nav class="tabs">
        @for (t of tabs; track t.id) {
          <button [class.active]="tab() === t.id" (click)="tab.set(t.id)">{{ t.label }}</button>
        }
      </nav>
      <button (click)="refresh()">Refresh</button>
    </div>
    @if (message()) { <p class="notice">{{ message() }}</p> }

    @switch (tab()) {
      @case ('deliveries') {
        <section class="card">
          <h2>Delivery log</h2>
          <p class="hint">Every attempt is recorded. Retryable failures back off automatically; failed deliveries can be retried by hand.</p>
          <table>
            <thead><tr><th>#</th><th>Status</th><th>Channel</th><th>Destination</th><th>User</th><th>Alert</th><th>Event</th><th>Attempts</th><th>Last error</th><th></th></tr></thead>
            <tbody>
              @for (d of deliveries(); track d.id) {
                <tr>
                  <td>{{ d.id }}</td>
                  <td><span class="badge" [class]="d.status">{{ d.status }}</span></td>
                  <td>{{ d.channelType }}</td>
                  <td>{{ d.destinationLabel }}</td>
                  <td>{{ d.userEmail }}</td>
                  <td>{{ d.alertName }}</td>
                  <td>{{ d.eventTitle }}</td>
                  <td [title]="attemptsTitle(d)">{{ d.attempts }}</td>
                  <td class="mono">{{ d.lastError }}</td>
                  <td>@if (d.status === 'failed') { <button (click)="retry(d)">Retry</button> }</td>
                </tr>
              } @empty { <tr><td colspan="10" class="empty">No deliveries yet.</td></tr> }
            </tbody>
          </table>
        </section>
      }

      @case ('events') {
        <div class="grid">
          <section class="card">
            <h2>Inject test event</h2>
            <p class="hint">Runs through the full pipeline (importance → matching → delivery). Marked as synthetic.</p>
            <form (ngSubmit)="inject()">
              <label>Category
                <select name="injCategory" [ngModel]="injCategory()" (ngModelChange)="injCategory.set($event)">
                  <option value="earthquake">Earthquake</option>
                  <option value="market">Market move</option>
                  <option value="news">News headline</option>
                </select>
              </label>
              @switch (injCategory()) {
                @case ('earthquake') {
                  <label>Magnitude <input name="magnitude" type="number" step="0.1" [(ngModel)]="inj.magnitude" /></label>
                  <label>Place <input name="place" [(ngModel)]="inj.place" /></label>
                }
                @case ('market') {
                  <label>Symbol <input name="symbol" [(ngModel)]="inj.symbol" /></label>
                  <label>Change (%) <input name="changePct" type="number" step="0.1" [(ngModel)]="inj.changePct" /></label>
                }
                @case ('news') {
                  <label>Headline <input name="headline" [(ngModel)]="inj.headline" /></label>
                }
              }
              <button type="submit">Inject</button>
            </form>
            <h3>Fixtures</h3>
            <button (click)="replay()">Replay synthetic fixtures</button>
          </section>

          <section class="card wide">
            <h2>Event feed</h2>
            <p class="hint">Each event's importance verdict and the rule that produced it.</p>
            <table>
              <thead><tr><th>Event</th><th>Category</th><th>Source</th><th>Important?</th><th>Why</th><th>Notified</th><th>Last updated</th></tr></thead>
              <tbody>
                @for (e of events(); track e.id) {
                  <tr>
                    <td>@if (e.url) { <a [href]="e.url" target="_blank" rel="noopener">{{ e.title }}</a> } @else { {{ e.title }} }</td>
                    <td>{{ e.category }}</td>
                    <td>{{ e.source }} @if (e.synthetic) { <span class="badge muted">synthetic</span> }</td>
                    <td>@if (e.baselinePassed) { <span class="badge sent">yes</span> } @else { <span class="badge muted">no</span> }</td>
                    <td>{{ e.baselineReason }}</td>
                    <td>{{ e.notificationCount }}</td>
                    <td>{{ e.lastUpdatedAt | date: 'MMM d, HH:mm' }}</td>
                  </tr>
                } @empty { <tr><td colspan="7" class="empty">No events yet.</td></tr> }
              </tbody>
            </table>
          </section>
        </div>
      }

      @case ('alerts') {
        <section class="card">
          <h2>Users</h2>
          <table>
            <thead><tr><th>Email</th><th>Role</th><th>Alerts</th></tr></thead>
            <tbody>
              @for (u of users(); track u.id) { <tr><td>{{ u.email }}</td><td>{{ u.role }}</td><td>{{ u.alertCount }}</td></tr> }
            </tbody>
          </table>
        </section>
        <section class="card">
          <h2>All alerts</h2>
          <table>
            <thead><tr><th>Name</th><th>Owner</th><th>Category</th><th>Filters</th><th>Notified</th><th>Status</th><th></th></tr></thead>
            <tbody>
              @for (a of alerts(); track a.id) {
                <tr>
                  <td>{{ a.name }}</td><td>{{ a.userEmail }}</td><td>{{ a.category }}</td>
                  <td class="mono">{{ filtersText(a) }}</td><td>{{ a.notificationCount }}</td>
                  <td>@if (a.enabled) { <span class="badge sent">active</span> } @else { <span class="badge muted">disabled</span> }</td>
                  <td><button (click)="toggle(a)">{{ a.enabled ? 'Disable' : 'Enable' }}</button></td>
                </tr>
              } @empty { <tr><td colspan="7" class="empty">No alerts yet.</td></tr> }
            </tbody>
          </table>
        </section>
      }

      @case ('sources') {
        <section class="card">
          <h2>Source health</h2>
          <table>
            <thead><tr><th>Source</th><th>Last success</th><th>Last error</th><th>Error at</th></tr></thead>
            <tbody>
              @for (s of sources(); track s.source) {
                <tr>
                  <td>{{ s.source }}</td>
                  <td>{{ s.lastSuccessAt | date: 'MMM d, HH:mm:ss' }}</td>
                  <td class="mono">{{ s.lastError }}</td>
                  <td>{{ s.lastErrorAt | date: 'MMM d, HH:mm:ss' }}</td>
                </tr>
              } @empty { <tr><td colspan="4" class="empty">No polls yet.</td></tr> }
            </tbody>
          </table>
          <p class="hint">USGS is the only live source; market and news are synthetic demo data.</p>
          <button (click)="poll()">Poll USGS now</button>
        </section>
      }
    }
  `,
})
export class AdminPage implements OnInit {
  private api = inject(Api);
  protected tabs: { id: Tab; label: string }[] = [
    { id: 'deliveries', label: 'Deliveries' },
    { id: 'events', label: 'Events' },
    { id: 'alerts', label: 'Users & alerts' },
    { id: 'sources', label: 'Sources' },
  ];
  tab = signal<Tab>('deliveries');
  message = signal('');

  deliveries = signal<Delivery[]>([]);
  events = signal<EventRow[]>([]);
  users = signal<AdminUser[]>([]);
  alerts = signal<Alert[]>([]);
  sources = signal<SourceStatus[]>([]);

  injCategory = signal<'earthquake' | 'market' | 'news'>('earthquake');
  inj = { magnitude: 6.8, place: 'Demo Trench', symbol: 'AAPL', changePct: -4.2, headline: 'Wildfire spreads near city' };

  ngOnInit() { void this.refresh(); }

  async refresh() {
    const [d, e, u, a, s] = await Promise.all([
      this.api.adminDeliveries(), this.api.adminEvents(), this.api.adminUsers(), this.api.adminAlerts(), this.api.adminSources(),
    ]);
    this.deliveries.set(d); this.events.set(e); this.users.set(u); this.alerts.set(a); this.sources.set(s);
  }

  private async run(action: () => Promise<string>) {
    try { this.message.set(await action()); } catch (err) { this.message.set(`Error: ${errorMessage(err)}`); }
    await this.refresh();
  }

  inject() {
    const c = this.injCategory();
    const body = c === 'earthquake' ? { category: c, magnitude: this.inj.magnitude, place: this.inj.place }
      : c === 'market' ? { category: c, symbol: this.inj.symbol, changePct: this.inj.changePct }
        : { category: c, headline: this.inj.headline };
    return this.run(async () => {
      const r = await this.api.injectEvent(body);
      return `Event #${r.eventId} ${r.status}: ${r.baselinePassed ? 'passed' : 'below'} baseline, ${r.notificationsCreated} notification(s). Deliveries go out within a few seconds; refresh to see them.`;
    });
  }

  replay() {
    return this.run(async () => {
      const r = await this.api.replayFixtures();
      return `Replayed ${r.length} fixture events, ${r.reduce((n, x) => n + x.notificationsCreated, 0)} notification(s).`;
    });
  }

  retry(d: Delivery) { return this.run(async () => { await this.api.retryDelivery(d.id); return `Delivery #${d.id} queued for retry.`; }); }
  toggle(a: Alert) { return this.run(async () => { await this.api.setAlertEnabled(a.id, !a.enabled); return `Alert "${a.name}" ${a.enabled ? 'disabled' : 'enabled'}.`; }); }
  poll() { return this.run(async () => { await this.api.pollUsgs(); return 'USGS polled.'; }); }

  attemptsTitle(d: Delivery) {
    return d.attemptLog.map((a) => `#${a.attempt} ${a.at}: ${a.ok ? 'ok' : a.error}`).join('\n');
  }

  filtersText(a: Alert) {
    return Object.entries(a.filters).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('; ');
  }
}
