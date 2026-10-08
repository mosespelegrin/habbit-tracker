import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { LocalStoreService } from './local-store.service';
import { apiBaseUrl } from '../config/api';

export type SyncStatus = 'signed-out' | 'offline' | 'syncing' | 'synced' | 'error';

interface SyncResponse {
  habits?: any[];
  checkins?: any[];
  scorecard?: any[];
  reviews?: any[];
}

const LAST_SYNCED_KEY = 'habitTrackerLastSyncedAt';
/** How long to coalesce rapid local edits into one sync round trip. */
const DEBOUNCE_MS = 3000;

/**
 * Keeps the local store and the server's MongoDB in step - the "when online" half of
 * the offline-first architecture. The app never waits on this service: every read and
 * write goes through LocalStoreService, and sync happens in the background.
 *
 * Round trip = one POST /api/sync with the whole local dataset (deletion tombstones
 * included). The server applies last-writer-wins and responds with its merged state,
 * which the client merges the same way - idempotent, safe to retry, no queue replay.
 *
 * Triggers: app start, after each local change (debounced), coming back online,
 * tab becoming visible, and the manual "Sync now" button in Settings.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  readonly status = signal<SyncStatus>('signed-out');
  readonly lastSyncedAt = signal<string | null>(this.safeGet(LAST_SYNCED_KEY));
  readonly lastError = signal<string | null>(null);

  /** Fires when a sync merged new records in, so open screens can reload. */
  readonly merged = new Subject<void>();

  private readonly url = `${apiBaseUrl()}/sync`;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlight = false;
  private queued = false;

  constructor(private http: HttpClient, private auth: AuthService, private store: LocalStoreService) {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.syncNow());
      window.addEventListener('offline', () => {
        if (this.status() !== 'signed-out') this.status.set('offline');
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') this.syncNow();
      });
    }
    // App start: pull down anything changed on another device since last visit.
    setTimeout(() => this.syncNow(), 400);
  }

  /** Debounced: called after every local mutation so rapid edits cost one round trip. */
  notifyChange(): void {
    if (!this.auth.isAuthenticated()) return;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.syncNow(), DEBOUNCE_MS);
  }

  async signIn(email: string, password: string): Promise<void> {
    await firstValueFrom(this.auth.login(email, password));
    await this.syncNow();
  }

  async register(email: string, password: string): Promise<void> {
    await firstValueFrom(this.auth.register(email, password));
    await this.syncNow();
  }

  signOut(): void {
    this.auth.logout();
    this.status.set('signed-out');
    this.lastError.set(null);
  }

  async syncNow(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (!this.auth.isAuthenticated()) {
      this.status.set('signed-out');
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.status.set('offline');
      return;
    }
    if (this.inFlight) {
      this.queued = true;
      return;
    }

    this.inFlight = true;
    this.status.set('syncing');
    this.lastError.set(null);

    const snapshot = this.store.exportSnapshot();
    const payload = {
      habits: snapshot.habits,
      checkins: snapshot.checkins,
      scorecard: snapshot.scorecard,
      reviews: snapshot.reviews,
      deleted: snapshot.deleted
    };

    try {
      const server = await firstValueFrom(this.http.post<SyncResponse>(this.url, payload));
      const counts = this.store.mergeServerResponse(server || {});
      this.store.clearTombstones(payload.deleted);

      const now = new Date().toISOString();
      this.lastSyncedAt.set(now);
      this.safeSet(LAST_SYNCED_KEY, now);
      this.status.set('synced');
      if (
        counts.habits + counts.checkins + counts.scorecard + counts.reviews > 0
      ) {
        this.merged.next();
      }
    } catch (error: any) {
      this.status.set(this.classifyError(error));
      this.lastError.set(this.messageFor(error));
    } finally {
      this.inFlight = false;
      if (this.queued) {
        this.queued = false;
        void this.syncNow();
      }
    }
  }

  private classifyError(error: any): SyncStatus {
    if (error?.status === 0 || typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
    // The interceptor already dropped the session on a 401.
    if (!this.auth.isAuthenticated()) return 'signed-out';
    return 'error';
  }

  private messageFor(error: any): string {
    if (error?.status === 0) return 'Offline - changes are saved on this device';
    if (error?.status === 429) return 'Too many requests - will retry later';
    if (!this.auth.isAuthenticated()) return 'Session expired - sign in again to sync';
    return error?.error?.message || 'Sync failed - your data is safe locally';
  }

  private safeGet(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private safeSet(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // localStorage unavailable - just don't persist the timestamp
    }
  }
}
