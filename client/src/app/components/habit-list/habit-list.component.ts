import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HabitService } from '../../services/habit.service';
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
  reminderTime: ''
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
export class HabitListComponent implements OnInit {

  readonly fourLaws = [
    { law: 'Make it Obvious', field: 'Cue', hint: 'Attach the habit to a clear trigger in your day.' },
    { law: 'Make it Attractive', field: 'Identity', hint: 'Tie the habit to who you want to become.' },
    { law: 'Make it Easy', field: '2-Minute Version', hint: 'Shrink it down so starting takes no willpower.' },
    { law: 'Make it Satisfying', field: 'Reward', hint: 'Give yourself an immediate, small payoff.' }
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

  constructor(private habitService: HabitService) { }

  ngOnInit() {
    this.loadHabits();
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
      reward: template.reward
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
      reminderTime: this.newHabit.reminderTime || ''
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
      reminderTime: habit.reminderTime || ''
    };
  }

  cancelEdit() {
    this.editingHabitId = null;
    this.editDraft = emptyDraft();
  }

  saveEdit(habitId: string) {
    if (!this.editDraft.name.trim() || this.isSavingEdit) return;

    const habit = {
      name: this.editDraft.name.trim(),
      identity: this.editDraft.identity.trim(),
      miniVersion: this.editDraft.miniVersion.trim(),
      cue: this.editDraft.cue.trim(),
      reward: this.editDraft.reward.trim(),
      stackedAfter: this.editDraft.stackedAfter || null,
      reminderTime: this.editDraft.reminderTime || ''
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
        this.showToast(
          habit?.reward
            ? `Habit complete - enjoy your reward: ${habit.reward}`
            : 'Habit complete - another vote cast for who you want to become.',
          'success'
        );
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
    const habit = this.habits.find((h) => h._id === habitId);
    const confirmed = window.confirm(`Delete "${habit?.name || 'this habit'}"? This can't be undone.`);
    if (!confirmed) return;

    this.deletingIds.add(habitId);
    this.habitService.deleteHabit(habitId).subscribe({
      next: () => {
        this.deletingIds.delete(habitId);
        if (this.editingHabitId === habitId) this.cancelEdit();
        this.loadHabits();
      },
      error: (err) => {
        this.deletingIds.delete(habitId);
        this.showToast(err.error?.message || 'Could not delete habit', 'error');
      }
    });
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

  get longestActiveStreak() {
    return Object.values(this.streaks).reduce((max, s) => Math.max(max, s?.streak || 0), 0);
  }

  get bestStreakEver() {
    return Object.values(this.streaks).reduce((max, s) => Math.max(max, s?.bestStreak || 0), 0);
  }
}
