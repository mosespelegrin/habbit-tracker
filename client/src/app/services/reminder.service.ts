import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export type ReminderPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

interface RemindableHabit {
  _id: string;
  name: string;
  reminderTime?: string;
}

/** Ids of notifications this service owns, so it only ever cancels its own. */
const ID_OFFSET = 10000;
const ENABLED_KEY = 'habitTrackerReminders';

/**
 * Per-habit reminder notifications.
 *
 * The PWA build used Web Push through the Angular service worker; with the service worker removed there is
 * no way to receive push in a plain browser, and the native app cannot receive Web Push either. The app
 * instead schedules a local notification for each habit's reminder time and re-schedules them every time
 * the habit list is loaded (which covers "next occurrence" without a background daemon).
 */
@Injectable({
  providedIn: 'root'
})
export class ReminderService {
  readonly permission = signal<ReminderPermission>('unsupported');

  constructor() {
    if (this.isNative) {
      void this.refreshPermission();
    }
  }

  get isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  get isEnabled(): boolean {
    try {
      return localStorage.getItem(ENABLED_KEY) !== 'off';
    } catch {
      return true;
    }
  }

  async refreshPermission(): Promise<void> {
    if (!this.isNative) {
      this.permission.set('unsupported');
      return;
    }

    try {
      const status = await LocalNotifications.checkPermissions();
      this.permission.set((status.display as ReminderPermission) || 'prompt');
    } catch {
      this.permission.set('prompt');
    }
  }

  /** Asks the OS for notification permission. Resolves only when it was granted. */
  async enable(): Promise<void> {
    if (!this.isNative) {
      throw new Error('Reminders are only available in the mobile app');
    }

    const status = await LocalNotifications.requestPermissions();
    this.permission.set((status.display as ReminderPermission) || 'prompt');

    if (status.display !== 'granted') {
      throw new Error('Notification permission was not granted');
    }

    this.setStoredEnabled(true);
  }

  /** Cancels every scheduled reminder and remembers that the user turned them off. */
  async disable(): Promise<void> {
    this.setStoredEnabled(false);
    await this.cancelAll();
  }

  /**
   * Replaces the whole schedule with the next occurrence of every habit's reminder time.
   * Called after each habit load, so habits added/edited/deleted keep the schedule correct.
   */
  async sync(habits: RemindableHabit[]): Promise<void> {
    if (!this.isNative) return;

    try {
      await this.cancelAll();

      if (!this.isEnabled) return;

      const status = await LocalNotifications.checkPermissions();
      if (status.display !== 'granted') return;

      const notifications = this.buildSchedule(habits);
      if (notifications.length) {
        await LocalNotifications.schedule({ notifications });
      }
    } catch (error) {
      console.warn('Could not schedule habit reminders', error);
    }
  }

  private buildSchedule(habits: RemindableHabit[]) {
    const now = new Date();
    const notifications: any[] = [];

    habits.forEach((habit, index) => {
      const match = /^(\d{1,2}):(\d{2})$/.exec((habit.reminderTime || '').trim());
      if (!match) return;

      const at = new Date(now);
      at.setHours(Number(match[1]), Number(match[2]), 0, 0);

      // Already past for today -> tomorrow. The next sync (app open / habit change) slides it forward again.
      if (at.getTime() <= now.getTime()) {
        at.setDate(at.getDate() + 1);
      }

      notifications.push({
        id: ID_OFFSET + index,
        title: 'Atomic habit reminder',
        body: `${habit.name} — keep the streak alive.`,
        schedule: { at },
        extra: { habitId: habit._id }
      });
    });

    return notifications;
  }

  private async cancelAll(): Promise<void> {
    if (!this.isNative) return;

    try {
      const pending = await LocalNotifications.getPending();
      const owned = pending.notifications.filter((notification) => notification.id >= ID_OFFSET);
      if (owned.length) {
        await LocalNotifications.cancel({ notifications: owned });
      }
    } catch (error) {
      console.warn('Could not cancel habit reminders', error);
    }
  }

  private setStoredEnabled(enabled: boolean) {
    try {
      localStorage.setItem(ENABLED_KEY, enabled ? 'on' : 'off');
    } catch {
      // localStorage unavailable - the choice just won't survive a restart
    }
  }
}
