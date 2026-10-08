import { Component, OnInit, OnDestroy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HabitService } from '../../services/habit.service';
import { SyncService } from '../../services/sync.service';
import { trigger, transition, style, animate } from '@angular/animations';

interface StreakInfo {
  streak: number;
  bestStreak: number;
  missedYesterday: boolean;
  doneToday: boolean;
}

interface HistoryDay {
  date: string;
  done: boolean;
}

interface IdentityStats {
  identity: string;
  provenCount: number;
  period: string;
}

interface StackChain {
  chain: string[];
}

interface HabitDraft {
  name: string;
  identity: string;
  miniVersion: string;
  cue: string;
  reward: string;
  stackedAfter: string;
  reminderTime: string;
  kind: 'grow' | 'break';
}

interface HabitTemplate {
  label: string;
  name: string;
  identity: string;
  miniVersion: string;
  cue: string;
  reward: string;
}

const emptyDraft = (): HabitDraft => ({
  name: '',
  identity: '',
  miniVersion: '',
  cue: '',
  reward: '',
  stackedAfter: '',
  reminderTime: '',
  kind: 'grow'
});

const HABIT_TEMPLATES: HabitTemplate[] = [
  { label: 'Drink water', name: 'Drink a glass of water', identity: 'I am someone who takes care of their body', miniVersion: 'Drink one sip', cue: 'After I wake up', reward: 'Feel refreshed' },
  { label: 'Read', name: 'Read', identity: 'I am a reader', miniVersion: 'Read one page', cue: 'After breakfast', reward: '5 minutes of guilt-free downtime' },
  { label: 'Exercise', name: 'Exercise', identity: 'I am an active person', miniVersion: 'Put on my workout clothes', cue: 'After work', reward: 'A hot shower' },
  { label: 'Meditate', name: 'Meditate', identity: 'I am a calm, focused person', miniVersion: 'Take 3 deep breaths', cue: 'Before checking my phone in the morning', reward: 'A moment of quiet' },
  { label: 'Journal', name: 'Journal', identity: 'I am reflective and self-aware', miniVersion: 'Write one sentence', cue: 'Before bed', reward: 'Closing the notebook feeling lighter' },
  { label: 'Tidy up', name: 'Tidy one surface', identity: 'I am an organized person', miniVersion: 'Put away one item', cue: 'When I get home', reward: 'A clean spot to look at' },
  { label: 'Learn a language', name: 'Practice a language', identity: 'I am a lifelong learner', miniVersion: 'Review 5 words', cue: 'During my commute', reward: 'One point on my streak' },
  { label: 'Track spending', name: "Track today's spending", identity: 'I am financially disciplined', miniVersion: 'Open my budget app', cue: 'After dinner', reward: 'Watching my savings grow' }
];

@Component({
  selector: 'app-habit-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './habit-list.component.html',
  styleUrl: './habit-list.component.css',
  animations: [
    trigger('habitAnimation', [
      transition('void => *', [
        style({ opacity: 0, transform: 'translateY(8px)' }),
        animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition('* => void', [
        animate('250ms ease-in', style({ opacity: 0, transform: 'translateX(-20px)' }))
      ])
    ]),
    trigger('toastAnimation', [
      transition('void => *', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition('* => void', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(-10px)' }))
      ])
    ])
  ]
})
export class HabitListComponent implements OnInit, OnDestroy {

  readonly fourLaws = [
    { law: 'Make it Obvious', field: 'Cue', hint: 'Attach the habit to a clear trigger in your day.' },
    { law: 'Make it Attractive', field: 'Identity', hint: 'Tie the habit to who you want to become.' },
    { law: 'Make it Easy', field: '2-Minute Version', hint: 'Shrink it down so starting takes no willpower.' },
    { law: 'Make it Satisfying', field: 'Reward', hint: 'Give yourself an immediate, small payoff.' }
  ];

  // Chapter 5: the same four laws inverted to dismantle a bad habit.
  readonly inverseLaws = [
    { law: 'Make it Invisible', field: 'Cue', hint: 'Reduce exposure - remove the cue from your environment.' },
    { law: 'Make it Unattractive', field: 'Identity', hint: 'Name the cost - who does this habit turn you into?' },
    { law: 'Make it Difficult', field: 'Friction', hint: 'Add 20 seconds of friction between you and the urge.' },
    { law: 'Make it Unsatisfying', field: 'Contract', hint: 'Add accountability - someone else is watching.' }
  ];

  readonly templates = HABIT_TEMPLATES;
  selectedTemplate = '';

  habits: any[] = [];
  newHabit: HabitDraft = emptyDraft();

  editingHabitId: string | null = null;
  editDraft: HabitDraft = emptyDraft();

  streaks: { [habitId: string]: StreakInfo | undefined } = {};
  histories: { [habitId: string]: HistoryDay[] } = {};
  identityStats: { [habitId: string]: IdentityStats } = {};
  miniMode: { [habitId: string]: boolean } = {};
  stackChains: StackChain[] = [];

  isLoading = true;
  isAddingHabit = false;
  isSavingEdit = false;
  checkingInIds = new Set<string>();
  deletingIds = new Set<string>();

  toast: string | null = null;
  toastType: 'success' | 'error' = 'success';
  private toastTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * Destructive-action guard: the first tap on Delete arms this id and the button asks for
   * confirmation; only a second tap deletes. Android WebView does not render window.confirm()
   * dialogs, so the confirmation is drawn by the UI instead of relying on native dialogs.
   */
  pendingDeleteId: string | null = null;
  private pendingDeleteTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private habitService: HabitService, private sync: SyncService, private destroyRef: DestroyRef) { }

  ngOnInit() {
    this.loadHabits();
    // A background sync can land records from another device (or the web build) - refresh when it does.
    this.sync.merged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadHabits());
  }

  loadHabits() {
    this.isLoading = true;
    this.habitService.getHabits().subscribe({
      next: (data: any) => {
        this.habits = data;
        this.isLoading = false;

        this.habits.forEach((habit) => {
          this.habitService.getStreaks(habit._id).subscribe((result: any) => {
            this.streaks[habit._id] = result;
          });

          this.habitService.getHistory(habit._id).subscribe((result: any) => {
            this.histories[habit._id] = result;
          });

          this.habitService.getIdentityStats(habit._id).subscribe((result: any) => {
            this.identityStats[habit._id] = result;
          });
        });

        this.loadStacks();
      },
      error: () => {
        this.isLoading = false;
        this.showToast('Could not load your habits. Check your connection and try again.', 'error');
      }
    });
  }

  applyTemplate() {
    const template = this.templates.find((t) => t.label === this.selectedTemplate);
    if (!template) return;

    this.newHabit = {
      ...this.newHabit,
      name: template.name,
      identity: template.identity,
      miniVersion: template.miniVersion,
      cue: template.cue,
      reward: template.reward,
      kind: 'grow'
    };
  }

  addHabit() {
    if (!this.newHabit.name.trim() || this.isAddingHabit) return;

    const habit = {
      name: this.newHabit.name.trim(),
      identity: this.newHabit.identity.trim(),
      miniVersion: this.newHabit.miniVersion.trim(),
      cue: this.newHabit.cue.trim(),
      reward: this.newHabit.reward.trim(),
      stackedAfter: this.newHabit.stackedAfter || null,
      reminderTime: this.newHabit.reminderTime || '',
      kind: (this.newHabit.kind === 'break' ? 'break' : 'grow') as 'grow' | 'break'
    };

    this.isAddingHabit = true;
    this.habitService.addHabit(habit).subscribe({
      next: () => {
        this.isAddingHabit = false;
        this.newHabit = emptyDraft();
        this.selectedTemplate = '';
        this.loadHabits();
      },
      error: (err) => {
        this.isAddingHabit = false;
        this.showToast(err.error?.message || 'Could not add habit', 'error');
      }
    });
  }

  startEdit(habit: any) {
    this.editingHabitId = habit._id;
    this.editDraft = {
      name: habit.name || '',
      identity: habit.identity || '',
      miniVersion: habit.miniVersion || '',
      cue: habit.cue || '',
      reward: habit.reward || '',
      stackedAfter: habit.stackedAfter || '',
      reminderTime: habit.reminderTime || '',
      kind: habit.kind === 'break' ? 'break' : 'grow'
    };
  }

  cancelEdit() {
    this.editingHabitId = null;
    this.editDraft = emptyDraft();
  }

  saveEdit(habitId: string) {
    if (!this.editDraft.name.trim() || this.isSavingEdit) return;

    const current = this.habits.find((habit) => habit._id === habitId);
    const habit = {
      name: this.editDraft.name.trim(),
      identity: this.editDraft.identity.trim(),
      miniVersion: this.editDraft.miniVersion.trim(),
      cue: this.editDraft.cue.trim(),
      reward: this.editDraft.reward.trim(),
      stackedAfter: this.editDraft.stackedAfter || null,
      reminderTime: this.editDraft.reminderTime || '',
      kind: (current?.kind === 'break' ? 'break' : 'grow') as 'grow' | 'break'
    };

    this.isSavingEdit = true;
    this.habitService.updateHabit(habitId, habit).subscribe({
      next: () => {
        this.isSavingEdit = false;
        this.editingHabitId = null;
        this.loadHabits();
      },
      error: (err) => {
        this.isSavingEdit = false;
        this.showToast(err.error?.message || 'Could not save changes', 'error');
      }
    });
  }

  otherHabits(habitId: string) {
    return this.habits.filter((habit) => habit._id !== habitId);
  }

  checkIn(habitId: string) {
    if (this.checkingInIds.has(habitId)) return;
    const habit = this.habits.find((h) => h._id === habitId);

    this.checkingInIds.add(habitId);
    this.habitService.checkInHabit(habitId).subscribe({
      next: () => {
        this.checkingInIds.delete(habitId);
        if (habit?.kind === 'break') {
          this.showToast(`Resisted — one less vote for "${habit.name}".`);
        } else {
          this.showToast(
            habit?.reward
              ? `Habit complete - enjoy your reward: ${habit.reward}`
              : 'Habit complete - another vote cast for who you want to become.'
          );
        }
        this.loadHabits();
      },
      error: (err) => {
        this.checkingInIds.delete(habitId);
        this.showToast(err.error?.message || 'Something went wrong', 'error');
      }
    });
  }

  deleteHabit(habitId: string) {
    if (this.deletingIds.has(habitId)) return;

    // First tap arms the confirmation; the button turns into "Tap to confirm".
    if (this.pendingDeleteId !== habitId) {
      this.armDeleteConfirmation(habitId);
      return;
    }

    this.clearDeleteConfirmation();
    const habit = this.habits.find((h) => h._id === habitId);
    this.deletingIds.add(habitId);
    this.habitService.deleteHabit(habitId).subscribe({
      next: () => {
        this.deletingIds.delete(habitId);
        if (this.editingHabitId === habitId) this.cancelEdit();
        this.loadHabits();
        this.showToast(`Deleted "${habit?.name || 'habit'}"`, 'success');
      },
      error: (err) => {
        this.deletingIds.delete(habitId);
        this.showToast(err.error?.message || 'Could not delete habit', 'error');
      }
    });
  }

  /** Arms (or re-arms) the delete confirmation, auto-reverting after 5 seconds. */
  armDeleteConfirmation(habitId: string) {
    this.pendingDeleteId = habitId;
    if (this.pendingDeleteTimer) clearTimeout(this.pendingDeleteTimer);
    this.pendingDeleteTimer = setTimeout(() => this.clearDeleteConfirmation(), 5000);
  }

  clearDeleteConfirmation() {
    this.pendingDeleteId = null;
    if (this.pendingDeleteTimer) {
      clearTimeout(this.pendingDeleteTimer);
      this.pendingDeleteTimer = undefined;
    }
  }

  ngOnDestroy() {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (this.pendingDeleteTimer) clearTimeout(this.pendingDeleteTimer);
  }

  loadStacks() {
    this.habitService.getStacks().subscribe((data: any) => {
      this.stackChains = data;
    });
  }

  toggleMiniMode(habitId: string) {
    this.miniMode[habitId] = !this.miniMode[habitId];
  }

  displayedHabitName(habit: any) {
    return this.miniMode[habit._id] && habit.miniVersion ? habit.miniVersion : habit.name;
  }

  isDangerZone(habitId: string) {
    const streak = this.streaks[habitId];
    return streak?.missedYesterday && !streak?.doneToday;
  }

  /** True when this habit is one the user is trying to break (inverse 4 Laws). */
  isBreak(habit: any): boolean {
    return habit?.kind === 'break';
  }

  /** Field labels swap to the inverse laws' vocabulary for break habits. */
  lawLabels(habit: any) {
    return habit?.kind === 'break'
      ? {
          identity: 'Identity — who you become without it',
          mini: 'Friction to add (20-second rule)',
          cue: 'Cue to remove (make it invisible)',
          reward: 'Contract if you slip (make it unsatisfying)'
        }
      : {
          identity: 'Identity',
          mini: '2-minute version',
          cue: 'Cue',
          reward: 'Reward'
        };
  }

  private showToast(message: string, type: 'success' | 'error' = 'success') {
    this.toast = message;
    this.toastType = type;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast = null;
    }, 4000);
  }

  get habitCount() {
    return this.habits.length;
  }

  get doneTodayCount() {
    return this.habits.filter((habit) => this.streaks[habit._id]?.doneToday).length;
  }

  get completionRate() {
    if (!this.habitCount) return 0;
    return Math.round((this.doneTodayCount / this.habitCount) * 100);
  }

  // These read through `this.habits` (not Object.values(this.streaks)) so a deleted habit's cached
  // streak can't keep inflating the dashboard after it is gone.
  get longestActiveStreak() {
    return this.habits.reduce((max, habit) => Math.max(max, this.streaks[habit._id]?.streak || 0), 0);
  }

  get bestStreakEver() {
    return this.habits.reduce((max, habit) => Math.max(max, this.streaks[habit._id]?.bestStreak || 0), 0);
  }

  // --- Level / XP: 10 XP per check-in in each habit's loaded 90-day history, 100 XP per level. ---
  readonly xpPerCheckIn = 10;
  readonly xpPerLevel = 100;
  private readonly ranks = ['E', 'D', 'C', 'B', 'A', 'S'];

  get totalXp() {
    const checkIns = this.habits.reduce(
      (sum, habit) => sum + (this.histories[habit._id] || []).filter((day) => day.done).length,
      0
    );
    return checkIns * this.xpPerCheckIn;
  }

  get level() {
    return Math.floor(this.totalXp / this.xpPerLevel) + 1;
  }

  get xpIntoLevel() {
    return this.totalXp % this.xpPerLevel;
  }

  get xpToNextLevel() {
    return this.xpPerLevel - this.xpIntoLevel;
  }

  get rank() {
    return this.ranks[Math.min(this.level - 1, this.ranks.length - 1)];
  }

  // --- Completion ring (SVG circle, r = 50) ---
  readonly ringCircumference = 2 * Math.PI * 50;

  get ringOffset() {
    return this.ringCircumference * (1 - this.completionRate / 100);
  }
}
