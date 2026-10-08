import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Capacitor } from '@capacitor/core';
import { ReminderService } from '../../services/reminder.service';
import { HabitService } from '../../services/habit.service';
import { DataService } from '../../services/data.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrls: ['../shared/panel.css', './settings.component.css']
})
export class SettingsComponent {
  isTogglingReminders = false;
  reminderError: string | null = null;
  /** Step 1 of just-in-time consent: show the plain-language rationale before the OS dialog. */
  reminderRationaleOpen = false;

  isExporting = false;
  isImporting = false;
  importMessage: string | null = null;
  dataError: string | null = null;

  constructor(
    public reminderService: ReminderService,
    private habitService: HabitService,
    private dataService: DataService
  ) {}

  /**
   * Just-in-time consent (MD A2): the first tap never triggers the system dialog - it opens the
   * in-app rationale. Only "Continue" on the rationale calls the OS permission request.
   */
  async enableReminders() {
    if (!this.reminderRationaleOpen) {
      this.reminderRationaleOpen = true;
      this.reminderError = null;
      return;
    }

    this.reminderRationaleOpen = false;
    this.isTogglingReminders = true;
    this.reminderError = null;

    try {
      await this.reminderService.enable();
      this.resyncReminders();
    } catch (err: any) {
      this.reminderError = err?.message || 'Could not enable reminders';
    } finally {
      this.isTogglingReminders = false;
    }
  }

  cancelRationale() {
    this.reminderRationaleOpen = false;
  }

  /** Short, human wording for the permission status row. */
  permissionLabel(): string {
    switch (this.reminderService.permission()) {
      case 'granted': return 'Allowed';
      case 'denied': return 'Blocked';
      case 'prompt': return 'Not asked yet';
      default: return 'Not supported on this device';
    }
  }

  /** Platform shown in the About section (web / android / ios). */
  platformLabel(): string {
    return Capacitor.getPlatform();
  }

  async disableReminders() {
    this.isTogglingReminders = true;
    this.reminderError = null;

    try {
      await this.reminderService.disable();
    } catch (err: any) {
      this.reminderError = err?.message || 'Could not disable reminders';
    } finally {
      this.isTogglingReminders = false;
    }
  }

  /** Reloading the habits re-runs the reminder schedule (see HabitService.getHabits). */
  private resyncReminders() {
    this.habitService.getHabits().subscribe({ error: () => { /* schedule stays as-is */ } });
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

      this.dataService.importData({
        habits: parsed.habits || [],
        checkins: parsed.checkins || [],
        scorecard: parsed.scorecard || [],
        reviews: parsed.reviews || []
      }).subscribe({
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
