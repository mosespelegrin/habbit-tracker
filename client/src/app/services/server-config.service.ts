import { Injectable } from '@angular/core';
import { API_ORIGIN, getApiOrigin, setApiOrigin } from '../config/api';

export interface ServerTestResult {
  ok: boolean;
  message: string;
}

/**
 * Validates and probes a candidate API origin, then persists it as the runtime override.
 *
 * Shared by Settings -> Server and the pre-auth control on the login screen: without the latter a
 * user whose device can't reach the compiled-in default would be stuck at the login form with no
 * way to point the app at the right server.
 */
@Injectable({ providedIn: 'root' })
export class ServerConfigService {
  /** The origin currently in effect (override if set, otherwise the build-time default). */
  get origin(): string {
    return getApiOrigin();
  }

  /** A usable origin is an absolute http(s) URL. */
  isValid(rawUrl: string): boolean {
    return /^https?:\/\/.+/i.test(rawUrl.trim().replace(/\/+$/, ''));
  }

  /**
   * Pings `<origin>/api/health` with an 8 s timeout so a typo or a wrong network is caught
   * before anything is saved. Never throws - the outcome arrives as `{ ok, message }`.
   */
  async test(rawUrl: string): Promise<ServerTestResult> {
    const origin = rawUrl.trim().replace(/\/+$/, '');

    if (!this.isValid(origin)) {
      return { ok: false, message: 'Enter a full address, e.g. http://192.168.1.100:3100' };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(`${origin}/api/health`, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`Server answered ${res.status}`);
      }
      return { ok: true, message: 'Connected - this address works.' };
    } catch (err: any) {
      return {
        ok: false,
        message:
          err?.name === 'AbortError'
            ? 'Timed out - is the server running and this device on the same network?'
            : `Could not reach that address (${err?.message || 'network error'})`
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Persists the override (saving the build default clears it, so no override is stored).
   * Returns `false` - and saves nothing - when the address is invalid.
   * The caller must reload: services build their base URL once at startup.
   */
  save(rawUrl: string): boolean {
    const origin = rawUrl.trim().replace(/\/+$/, '');
    if (!this.isValid(origin)) {
      return false;
    }
    setApiOrigin(origin === API_ORIGIN ? null : origin);
    return true;
  }
}
