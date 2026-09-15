import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PushService } from '../../services/push.service';
import { DataService } from '../../services/data.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings.component.html',
  styleUrls: ['../shared/panel.css', './settings.component.css']
})
export class SettingsComponent {
  isEnablingPush = false;
  pushError: string | null = null;

  isExporting = false;
  isImporting = false;
  importMessage: string | null = null;
  dataError: string | null = null;

  constructor(
    public authService: AuthService,
    public pushService: PushService,
    private dataService: DataService,
    private router: Router
  ) { }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  async enablePush() {
    this.isEnablingPush = true;
    this.pushError = null;

    try {
      await this.pushService.enable();
    } catch (err: any) {
      this.pushError = err?.message || 'Could not enable push reminders';
    } finally {
      this.isEnablingPush = false;
    }
  }

  async disablePush() {
    this.isEnablingPush = true;
    this.pushError = null;

    try {
      await this.pushService.disable();
    } catch (err: any) {
      this.pushError = err?.message || 'Could not disable push reminders';
    } finally {
      this.isEnablingPush = false;
    }
  }

  exportData() {
    this.isExporting = true;
    this.dataError = null;

    this.dataService.exportData().subscribe({
      next: (data) => {
        this.isExporting = false;
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `habit-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.isExporting = false;
        this.dataError = 'Could not export your data';
      }
    });
  }

  async onImportFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.isImporting = true;
    this.importMessage = null;
    this.dataError = null;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      this.dataService.importData({ habits: parsed.habits || [], checkins: parsed.checkins || [] }).subscribe({
        next: (result) => {
          this.isImporting = false;
          this.importMessage = `Imported ${result.importedHabits} habit(s) and ${result.importedCheckins} check-in(s).`;
        },
        error: (err) => {
          this.isImporting = false;
          this.dataError = err.error?.message || 'Could not import that file';
        }
      });
    } catch {
      this.isImporting = false;
      this.dataError = 'That file is not valid JSON';
    } finally {
      input.value = '';
    }
  }
}
