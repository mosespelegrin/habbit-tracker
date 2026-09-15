import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { SwPush } from '@angular/service-worker';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class PushService {
  private apiBaseUrl = window.location.port === '4200' ? 'http://localhost:3000/api' : '/api';
  private url = `${this.apiBaseUrl}/push`;

  constructor(private httpClient: HttpClient, private swPush: SwPush) { }

  get isSupported(): boolean {
    return this.swPush.isEnabled && typeof Notification !== 'undefined';
  }

  get permission(): NotificationPermission | 'unsupported' {
    return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
  }

  async enable(): Promise<void> {
    if (!this.isSupported) {
      throw new Error('Push notifications are not supported in this browser');
    }

    const { publicKey } = await firstValueFrom(
      this.httpClient.get<{ publicKey: string }>(`${this.url}/vapid-public-key`)
    );

    const subscription = await this.swPush.requestSubscription({ serverPublicKey: publicKey });
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    await firstValueFrom(
      this.httpClient.post(`${this.url}/subscribe`, { subscription: subscription.toJSON(), timezone })
    );
  }

  async disable(): Promise<void> {
    const subscription = await firstValueFrom(this.swPush.subscription).catch(() => null);
    if (subscription) {
      await firstValueFrom(this.httpClient.post(`${this.url}/unsubscribe`, { endpoint: subscription.endpoint }));
      await this.swPush.unsubscribe();
    }
  }
}
