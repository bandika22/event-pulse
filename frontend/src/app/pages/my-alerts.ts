import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Alert, Api, Category, ChannelInfo, Destination, errorMessage } from '../api';

const BASELINE = { minMagnitude: 5, minChangePct: 2 };

@Component({
  selector: 'app-my-alerts',
  imports: [FormsModule],
  template: `
    <div class="grid">
      <section class="card">
        <h2>Destinations</h2>
        <p class="hint">Where notifications are delivered. Alerts can send to several destinations.</p>
        @if (destinations().length) {
          <table>
            <thead><tr><th>Label</th><th>Channel</th><th>Config</th></tr></thead>
            <tbody>
              @for (d of destinations(); track d.id) {
                <tr><td>{{ d.label }}</td><td>{{ channelName(d.channelType) }}</td><td class="mono">{{ configText(d) }}</td></tr>
              }
            </tbody>
          </table>
        } @else { <p class="empty">No destinations yet.</p> }

        <h3>Add destination</h3>
        <form (ngSubmit)="addDestination()">
          <label>Channel
            <select name="channelType" [ngModel]="destType()" (ngModelChange)="selectChannel($event)">
              @for (c of channels(); track c.type) { <option [value]="c.type">{{ c.displayName }}</option> }
            </select>
          </label>
          <label>Label <input name="label" [(ngModel)]="destLabel" placeholder="e.g. Work inbox" /></label>
          <!-- Rendered from the channel's configFields, so a new channel needs no frontend change (AC9). -->
          @for (f of selectedChannel()?.configFields ?? []; track f.name) {
            <label>{{ f.label }}
              <input [name]="'cfg-' + f.name" [type]="f.kind" [required]="f.required" [(ngModel)]="destConfig[f.name]" />
              @if (f.help) { <small class="hint">{{ f.help }}</small> }
            </label>
          }
          @if (destError()) { <p class="error">{{ destError() }}</p> }
          <button type="submit">Add destination</button>
        </form>
      </section>

      <section class="card">
        <h2>My alerts</h2>
        @if (alerts().length) {
          <table>
            <thead><tr><th>Name</th><th>Category</th><th>Rule</th><th>Sends to</th><th>Notified</th><th>Status</th></tr></thead>
            <tbody>
              @for (a of alerts(); track a.id) {
                <tr>
                  <td>{{ a.name }}</td>
                  <td>{{ a.category }}</td>
                  <td>{{ ruleText(a) }}</td>
                  <td>{{ destinationNames(a.destinationIds) }}</td>
                  <td>{{ a.notificationCount }}</td>
                  <td>@if (a.enabled) { <span class="badge ok">active</span> } @else { <span class="badge muted">disabled by admin</span> }</td>
                </tr>
              }
            </tbody>
          </table>
        } @else { <p class="empty">No alerts yet.</p> }

        <h3>New alert</h3>
        <form (ngSubmit)="addAlert()">
          <label>Name <input name="name" [(ngModel)]="alertName" required placeholder="e.g. Big earthquakes" /></label>
          <label>Category
            <select name="category" [ngModel]="category()" (ngModelChange)="category.set($event)">
              <option value="earthquake">Earthquakes (live USGS data)</option>
              <option value="market">Market moves (synthetic demo data)</option>
              <option value="news">News (synthetic demo data)</option>
            </select>
          </label>
          @switch (category()) {
            @case ('earthquake') {
              <label>Minimum magnitude
                <input name="minMagnitude" type="number" step="0.1" [min]="baseline.minMagnitude" [(ngModel)]="minMagnitude" />
                <small class="hint">System baseline is M{{ baseline.minMagnitude }}; you can raise it, not lower it.</small>
              </label>
            }
            @case ('market') {
              <label>Symbol <input name="symbol" [(ngModel)]="symbol" placeholder="AAPL" /></label>
              <label>Minimum move (%)
                <input name="minChangePct" type="number" step="0.1" [min]="baseline.minChangePct" [(ngModel)]="minChangePct" />
                <small class="hint">Either direction. System baseline is {{ baseline.minChangePct }}%.</small>
              </label>
            }
            @case ('news') {
              <label>Keywords <input name="keywords" [(ngModel)]="keywords" placeholder="wildfire, interest rate" />
                <small class="hint">Comma-separated. Matches whole words in the headline, case-insensitive.</small>
              </label>
            }
          }
          <fieldset>
            <legend>Send to</legend>
            @for (d of destinations(); track d.id) {
              <label class="check"><input type="checkbox" [name]="'dest-' + d.id" [(ngModel)]="selectedDest[d.id]" /> {{ d.label }} ({{ channelName(d.channelType) }})</label>
            } @empty { <p class="empty">Add a destination first.</p> }
          </fieldset>
          <p class="hint">Alerts only fire for events first seen after the alert is created (no backfill).</p>
          @if (alertError()) { <p class="error">{{ alertError() }}</p> }
          <button type="submit" [disabled]="!destinations().length">Create alert</button>
        </form>
      </section>
    </div>
  `,
})
export class MyAlertsPage implements OnInit {
  private api = inject(Api);
  protected baseline = BASELINE;

  channels = signal<ChannelInfo[]>([]);
  destinations = signal<Destination[]>([]);
  alerts = signal<Alert[]>([]);

  destType = signal('');
  selectedChannel = computed(() => this.channels().find((c) => c.type === this.destType()));
  destLabel = '';
  destConfig: Record<string, string> = {};
  destError = signal('');

  category = signal<Category>('earthquake');
  alertName = '';
  minMagnitude = BASELINE.minMagnitude;
  symbol = '';
  minChangePct = BASELINE.minChangePct;
  keywords = '';
  selectedDest: Record<number, boolean> = {};
  alertError = signal('');

  async ngOnInit() {
    const [channels] = await Promise.all([this.api.channels(), this.refresh()]);
    this.channels.set(channels);
    this.destType.set(channels[0]?.type ?? '');
  }

  async refresh() {
    const [d, a] = await Promise.all([this.api.destinations(), this.api.alerts()]);
    this.destinations.set(d);
    this.alerts.set(a);
  }

  selectChannel(type: string) {
    this.destType.set(type);
    this.destConfig = {};
  }

  async addDestination() {
    this.destError.set('');
    try {
      await this.api.createDestination({ channelType: this.destType(), label: this.destLabel, config: this.destConfig });
      this.destLabel = '';
      this.destConfig = {};
      await this.refresh();
    } catch (err) {
      this.destError.set(errorMessage(err));
    }
  }

  async addAlert() {
    this.alertError.set('');
    const cat = this.category();
    const filters =
      cat === 'earthquake' ? { minMagnitude: this.minMagnitude }
        : cat === 'market' ? { symbol: this.symbol, minChangePct: this.minChangePct }
          : { keywords: this.keywords.split(',').map((k) => k.trim()).filter(Boolean) };
    const destinationIds = Object.entries(this.selectedDest).filter(([, on]) => on).map(([id]) => Number(id));
    try {
      await this.api.createAlert({ name: this.alertName, category: cat, filters, destinationIds });
      this.alertName = '';
      this.selectedDest = {};
      await this.refresh();
    } catch (err) {
      this.alertError.set(errorMessage(err));
    }
  }

  channelName(type: string) {
    return this.channels().find((c) => c.type === type)?.displayName ?? type;
  }

  configText(d: Destination) {
    return Object.values(d.config).join(', ');
  }

  destinationNames(ids: number[]) {
    return ids.map((id) => this.destinations().find((d) => d.id === id)?.label ?? `#${id}`).join(', ');
  }

  ruleText(a: Alert) {
    const f = a.filters as Record<string, unknown>;
    if (a.category === 'earthquake') return `M ≥ ${f['minMagnitude']}`;
    if (a.category === 'market') return `${f['symbol']} moves ≥ ${f['minChangePct']}%`;
    return `mentions: ${(f['keywords'] as string[]).join(', ')}`;
  }
}
