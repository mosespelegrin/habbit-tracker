import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './services/auth.service';

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

  constructor(public authService: AuthService) {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('habitTrackerTheme');
    } catch {
      // localStorage unavailable (private mode, disabled cookies, etc.) - fall back below
    }

    this.darkMode = saved
      ? saved === 'dark'
      : !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    this.applyTheme();
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
