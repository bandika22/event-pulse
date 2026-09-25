import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type Category = 'earthquake' | 'market' | 'news';
export interface User { id: number; email: string; role: 'user' | 'admin' }
export interface ConfigField { name: string; label: string; kind: 'text' | 'email' | 'url'; required: boolean; sensitive?: boolean; help?: string }
export interface ChannelInfo { type: string; displayName: string; configFields: ConfigField[] }
export interface Destination { id: number; channelType: string; label: string; config: Record<string, string>; createdAt: string }
export interface Alert {
  id: number; name: string; category: Category; filters: Record<string, unknown>; enabled: boolean;
  createdAt: string; userEmail: string; notificationCount: number; destinationIds: number[];
}
export interface AdminUser { id: number; email: string; role: string; createdAt: string; alertCount: number }
export interface EventRow {
  id: number; source: string; sourceEventId: string; category: Category; title: string; url: string | null;
  occurredAt: string; firstSeenAt: string; lastUpdatedAt: string; synthetic: boolean; data: Record<string, unknown>;
  baselinePassed: boolean; baselineReason: string; notificationCount: number;
}
export interface Attempt { attempt: number; at: string; ok: number; retryable: number | null; error: string | null }
export interface Delivery {
  id: number; status: 'pending' | 'retrying' | 'sent' | 'failed'; attempts: number; lastError: string | null;
  nextAttemptAt: string | null; sentAt: string | null; createdAt: string; channelType: string; destinationLabel: string;
  alertId: number; alertName: string; userEmail: string; eventId: number; eventTitle: string; attemptLog: Attempt[];
}
export interface SourceStatus { source: string; lastSuccessAt: string | null; lastError: string | null; lastErrorAt: string | null }
export interface IngestResult { eventId: number; status: string; baselinePassed: boolean; notificationsCreated: number }

/** Thin typed wrapper over the backend API (proxied to :3000 in dev). */
@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);
  private get = <T>(url: string) => firstValueFrom(this.http.get<T>(url));
  private post = <T>(url: string, body: unknown = {}) => firstValueFrom(this.http.post<T>(url, body));

  login = (email: string, password: string) => this.post<User>('/api/auth/login', { email, password });
  logout = () => this.post<{ ok: true }>('/api/auth/logout');
  me = () => this.get<User>('/api/auth/me');

  channels = () => this.get<ChannelInfo[]>('/api/channels');
  destinations = () => this.get<Destination[]>('/api/destinations');
  createDestination = (body: { channelType: string; label: string; config: Record<string, string> }) => this.post<Destination>('/api/destinations', body);
  alerts = () => this.get<Alert[]>('/api/alerts');
  createAlert = (body: { name: string; category: Category; filters: unknown; destinationIds: number[] }) => this.post<Alert>('/api/alerts', body);

  adminUsers = () => this.get<AdminUser[]>('/api/admin/users');
  adminAlerts = () => this.get<Alert[]>('/api/admin/alerts');
  setAlertEnabled = (id: number, enabled: boolean) => this.post<Alert>(`/api/admin/alerts/${id}/${enabled ? 'enable' : 'disable'}`);
  adminEvents = () => this.get<EventRow[]>('/api/admin/events?limit=100');
  adminDeliveries = () => this.get<Delivery[]>('/api/admin/deliveries');
  retryDelivery = (id: number) => this.post<{ ok: true }>(`/api/admin/deliveries/${id}/retry`);
  adminSources = () => this.get<SourceStatus[]>('/api/admin/sources');
  pollUsgs = () => this.post<unknown>('/api/admin/sources/usgs/poll');
  injectEvent = (body: Record<string, unknown>) => this.post<IngestResult>('/api/admin/events/inject', body);
  replayFixtures = () => this.post<IngestResult[]>('/api/admin/fixtures/replay');
}

/** Pulls the backend's `{ error }` message out of an HttpErrorResponse. */
export function errorMessage(err: unknown): string {
  const e = err as { error?: { error?: string }; message?: string; status?: number };
  return e.error?.error ?? (e.status === 0 ? 'Backend unreachable' : e.message ?? 'Request failed');
}
