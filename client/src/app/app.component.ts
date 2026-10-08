import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './services/auth.service';
import { SyncService } from './services/sync.service';

const QUOTES: string[] = [
  'You do not rise to the level of your goals. You fall to the level of your systems.',
  'Every action you take is a vote for the type of person you wish to become.',
  'Habits are the compound interest of self-improvement.',
  'You should be far more concerned with your current trajectory than with your current results.',
  'The most practical way to change who you are is to change what you do.',
  'Success is the product of daily habits, not once-in-a-lifetime transformations.'
];

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'client';
  quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  darkMode = false;

  constructor(public auth: AuthService, public sync: SyncService) {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('habitTrackerTheme');
    } catch {
      // localStorage unavailable (private mode, disabled cookies, etc.) - fall back below
    }

    // The violet "system" look is dark-first, so dark is the default until the user picks otherwise.
    this.darkMode = saved ? saved === 'dark' : true;
    this.applyTheme();
  }

  /** Compact label for the topbar sync pill (only shown while signed in). */
  statusText(): string {
    switch (this.sync.status()) {
      case 'syncing': return 'Syncing';
      case 'synced': return 'Synced';
      case 'offline': return 'Offline';
      case 'error': return 'Sync issue';
      default: return '';
    }
  }

  toggleTheme() {
    this.darkMode = !this.darkMode;
    try {
      localStorage.setItem('habitTrackerTheme', this.darkMode ? 'dark' : 'light');
    } catch {
      // localStorage unavailable - theme choice just won't persist across reloads
    }
    this.applyTheme();
  }

  private applyTheme() {
    document.documentElement.setAttribute('data-theme', this.darkMode ? 'dark' : 'light');
  }
}
