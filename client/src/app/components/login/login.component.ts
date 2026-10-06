import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { AuthService } from '../../services/auth.service';
import { ServerConfigService } from '../../services/server-config.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './auth-form.css'
})
export class LoginComponent {
  email = '';
  password = '';
  error: string | null = null;
  isSubmitting = false;

  /** The server control only matters where the API origin isn't the page's own (native builds). */
  readonly isNative = Capacitor.isNativePlatform();
  showServerPanel = false;
  serverHint: string | null = null;
  serverUrl = '';
  serverStatus: string | null = null;
  serverError: string | null = null;
  isTestingServer = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private serverConfig: ServerConfigService
  ) {
    this.serverUrl = this.serverConfig.origin;
  }

  submit() {
    if (!this.email.trim() || !this.password || this.isSubmitting) return;

    this.isSubmitting = true;
    this.error = null;

    this.authService.login(this.email.trim(), this.password).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.router.navigate(['/habits']);
      },
      error: (err) => {
        this.isSubmitting = false;

        // Status 0 = the request never reached a server. Surface the server control instead of a
        // bare "Could not log in", so the user has a next action (point the app at the right API).
        if (err?.status === 0) {
          this.error = 'This device can\u2019t reach the server.';
          this.serverHint =
            `The app is currently pointing at "${this.serverConfig.origin}". ` +
            'If that\u2019s not your server, enter the right address below and save.';
          this.showServerPanel = true;
          return;
        }

        this.error = err.error?.message || 'Could not log in';
      }
    });
  }

  toggleServerPanel() {
    this.showServerPanel = !this.showServerPanel;
    if (!this.showServerPanel) {
      this.serverHint = null;
      this.serverStatus = null;
      this.serverError = null;
    } else {
      this.serverUrl = this.serverConfig.origin;
    }
  }

  /** Pings /api/health at the typed address so a typo is caught before saving. */
  testServer() {
    this.serverStatus = null;
    this.serverError = null;
    this.isTestingServer = true;

    this.serverConfig.test(this.serverUrl).then((result) => {
      this.isTestingServer = false;
      if (result.ok) {
        this.serverStatus = result.message;
      } else {
        this.serverError = result.message;
      }
    });
  }

  /** Persists the address on this device and reloads so the new origin takes effect. */
  saveServer() {
    this.serverError = null;

    if (!this.serverConfig.save(this.serverUrl)) {
      this.serverError = 'Enter a full address, e.g. http://192.168.1.100:3100';
      return;
    }

    window.location.reload();
  }
}
