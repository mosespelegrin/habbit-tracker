import { Capacitor } from '@capacitor/core';

/**
 * Origin of the deployed API server (no trailing slash, no `/api`).
 *
 * The web build talks to `/api` on its own origin, and `ng serve` proxies to localhost:3000 - neither of
 * which exists for the native app. A WebView loading files from disk has a `capacitor://` / `http://localhost`
 * origin, so the packaged app has to be told explicitly where the API lives. The API is only used for the
 * optional cloud sync (the app is fully functional offline without it).
 *
 * Default is the hosted Render service so the phone can sync out of the box - or change it at runtime from
 * Settings -> Sync inside the app (stored in localStorage, overrides this constant).
 */
export const API_ORIGIN = 'https://atomic-habit-tracker.onrender.com';

/** localStorage key for the runtime server override set from the Settings screen (native builds only). */
const API_ORIGIN_KEY = 'habitTrackerApiOrigin';

const DEV_API_BASE = 'http://localhost:3000/api';

/** Strips trailing slashes so callers can safely append `/api`. */
function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

/** The API origin in effect: the in-app override if set, otherwise the build-time constant. */
export function getApiOrigin(): string {
  try {
    const saved = localStorage.getItem(API_ORIGIN_KEY);
    if (saved) {
      return normalizeOrigin(saved);
    }
  } catch {
    // localStorage unavailable - fall through to the build-time default
  }
  return API_ORIGIN;
}

/**
 * Saves (or clears, with `null`) the runtime server override.
 * The app must be reloaded afterwards so services rebuild their base URLs.
 */
export function setApiOrigin(origin: string | null): void {
  try {
    if (origin === null) {
      localStorage.removeItem(API_ORIGIN_KEY);
    } else {
      localStorage.setItem(API_ORIGIN_KEY, normalizeOrigin(origin));
    }
  } catch {
    // localStorage unavailable - override just won't persist
  }
}

/** Returns the base URL (ending in `/api`) every HTTP service should call. */
export function apiBaseUrl(): string {
  // `ng serve` - no server on :4200, so talk to the API directly.
  if (typeof window !== 'undefined' && window.location.port === '4200') {
    return DEV_API_BASE;
  }

  // Native (Capacitor) build - always absolute.
  if (Capacitor.isNativePlatform()) {
    return `${getApiOrigin()}/api`;
  }

  // Hosted web build - the Express server serves the client and the API from one origin.
  return '/api';
}
