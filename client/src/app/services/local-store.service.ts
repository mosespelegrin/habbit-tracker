import { Injectable } from '@angular/core';

/**
 * Pure-offline data engine. Everything the app knows lives in localStorage on this device -
 * no server, no account, no network. All of the server's domain rules (streak math, history
 * windows, trend buckets, habit stacks, duplicate check-in protection) are mirrored here so
 * the UI keeps behaving exactly as before, just locally.
 *
 * The device's own timezone is the source of truth for "today", which is what the server used
 * the request timezone for anyway.
 */

export type HabitKind = 'grow' | 'break';
export type ScorecardRating = 'positive' | 'negative' | 'neutral';

export interface Habit {
  _id: string;
  name: string;
  identity: string;
  miniVersion: string;
  cue: string;
  reward: string;
  stackedAfter: string | null;
  reminderTime: string;
  kind: HabitKind;
  createdAt: string;
}

export interface CheckIn {
  _id: string;
  habit: string;
  date: string;
  done: boolean;
}

export interface ScorecardEntry {
  _id: string;
  text: string;
  rating: ScorecardRating;
  createdAt: string;
}

export interface WeeklyReview {
  weekStart: string;
  wins: string;
  misses: string;
  tweak: string;
}

export interface StreakInfo {
  streak: number;
  bestStreak: number;
  missedYesterday: boolean;
  doneToday: boolean;
}

export interface HistoryDay {
  date: string;
  done: boolean;
}

export interface TrendWeek {
  weekStart: string;
  completionRate: number;
}

export interface IdentityStats {
  identity: string;
  provenCount: number;
  period: string;
}

export interface StackChain {
  chain: string[];
}

interface Database {
  habits: Habit[];
  checkins: CheckIn[];
  scorecard: ScorecardEntry[];
  reviews: WeeklyReview[];
}

const STORAGE_KEY = 'atomicOfflineDb.v1';

const emptyDb = (): Database => ({ habits: [], checkins: [], scorecard: [], reviews: [] });

// --- Local-calendar date helpers -------------------------------------------

const dayKeyOf = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Noon local time sidesteps DST edge cases when shifting whole days.
const dateFromKey = (key: string): Date => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1, 12, 0, 0, 0);
};

const shiftKey = (key: string, days: number): string => {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + days);
  return dayKeyOf(date);
};

const daysBetweenKeys = (from: string, to: string): number =>
  Math.round((dateFromKey(to).getTime() - dateFromKey(from).getTime()) / 86400000);

const todayKey = (): string => dayKeyOf(new Date());

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

// --- Ids --------------------------------------------------------------------

const newId = (): string => {
  const bytes = new Uint8Array(12);
  const webCrypto: Crypto | undefined = typeof crypto !== 'undefined' ? crypto : undefined;
  if (webCrypto && typeof webCrypto.getRandomValues === 'function') {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const REMINDER_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const RATING_VALUES: ScorecardRating[] = ['positive', 'negative', 'neutral'];

@Injectable({
  providedIn: 'root'
})
export class LocalStoreService {
  private db: Database;

  constructor() {
    this.db = this.load();
  }

  // --- Persistence ----------------------------------------------------------

  private load(): Database {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyDb();
      const parsed = JSON.parse(raw);
      return {
        habits: Array.isArray(parsed?.habits) ? parsed.habits : [],
        checkins: Array.isArray(parsed?.checkins) ? parsed.checkins : [],
        scorecard: Array.isArray(parsed?.scorecard) ? parsed.scorecard : [],
        reviews: Array.isArray(parsed?.reviews) ? parsed.reviews : []
      };
    } catch {
      // localStorage unavailable or corrupt - run from memory so the UI still works.
      return emptyDb();
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.db));
    } catch {
      // Persist failed (private mode / quota) - data stays in memory for this session.
    }
  }

  // --- Habits ---------------------------------------------------------------

  listHabits(): Habit[] {
    return [...this.db.habits];
  }

  createHabit(input: Partial<Habit>): Habit {
    const habit = this.sanitizeHabit(input, { requireName: true });
    if (habit.stackedAfter && !this.db.habits.some((h) => h._id === habit.stackedAfter)) {
      throw new Error('stackedAfter habit not found');
    }

    const record: Habit = {
      ...habit,
      _id: newId(),
      createdAt: new Date().toISOString()
    };
    this.db.habits.push(record);
    this.save();
    return record;
  }

  updateHabit(id: string, input: Partial<Habit>): Habit {
    const index = this.db.habits.findIndex((h) => h._id === id);
    if (index === -1) throw new Error('Habit not found');

    // Merge over the existing record so partial updates don't blank untouched fields.
    const habit = this.sanitizeHabit({ ...this.db.habits[index], ...input });
    if (habit.stackedAfter === id) throw new Error('A habit cannot be stacked after itself');
    if (habit.stackedAfter && !this.db.habits.some((h) => h._id === habit.stackedAfter)) {
      throw new Error('stackedAfter habit not found');
    }

    const updated: Habit = { ...this.db.habits[index], ...habit, _id: id };
    this.db.habits[index] = updated;
    this.save();
    return updated;
  }

  deleteHabit(id: string): Habit {
    const index = this.db.habits.findIndex((h) => h._id === id);
    if (index === -1) throw new Error('Habit not found');

    const [removed] = this.db.habits.splice(index, 1);
    this.db.checkins = this.db.checkins.filter((c) => c.habit !== id);
    this.save();
    return removed;
  }

  private sanitizeHabit(
    input: Partial<Habit>,
    options: { requireName?: boolean } = {}
  ): Habit {
    const source = input || {};
    const name = source.name ?? '';
    const identity = source.identity ?? '';
    const miniVersion = source.miniVersion ?? '';
    const cue = source.cue ?? '';
    const reward = source.reward ?? '';
    const stackedAfter = source.stackedAfter === ('' as any) ? null : (source.stackedAfter ?? null);
    const reminderTime = source.reminderTime ?? '';

    if (options.requireName && typeof name !== 'string') throw new Error('Name is required');
    if (name !== undefined && typeof name !== 'string') throw new Error('name must be text');
    if (typeof name === 'string' && !name.trim()) throw new Error('Name cannot be empty');
    for (const field of ['identity', 'miniVersion', 'cue', 'reward'] as const) {
      if ((source as any)[field] !== undefined && typeof (source as any)[field] !== 'string') {
        throw new Error(`${field} must be text`);
      }
    }
    if (stackedAfter !== null && typeof stackedAfter !== 'string') {
      throw new Error('stackedAfter must be a valid habit id');
    }
    if (reminderTime !== '' && !REMINDER_RE.test(reminderTime)) {
      throw new Error('reminderTime must be in HH:MM 24-hour format');
    }

    return {
      name: String(name).trim(),
      identity: String(identity).trim(),
      miniVersion: String(miniVersion).trim(),
      cue: String(cue).trim(),
      reward: String(reward).trim(),
      stackedAfter: stackedAfter || null,
      reminderTime,
      kind: source.kind === 'break' ? 'break' : 'grow'
    } as Habit;
  }

  // --- Check-ins ------------------------------------------------------------

  checkIn(habitId: string): CheckIn {
    const habit = this.db.habits.find((h) => h._id === habitId);
    if (!habit) throw new Error('Habit not found');

    const key = todayKey();
    const alreadyDone = this.db.checkins.some(
      (checkIn) => checkIn.habit === habitId && dayKeyOf(new Date(checkIn.date)) === key
    );
    if (alreadyDone) throw new Error('Check-in already exists for this habit today');

    const record: CheckIn = {
      _id: newId(),
      habit: habitId,
      date: new Date().toISOString(),
      done: true
    };
    this.db.checkins.push(record);
    this.save();
    return record;
  }

  streaks(habitId: string): StreakInfo {
    const checkinDays = new Set(
      this.db.checkins
        .filter((checkIn) => checkIn.habit === habitId && checkIn.done)
        .map((checkIn) => dayKeyOf(new Date(checkIn.date)))
    );

    const currentKey = todayKey();
    const yesterdayKey = shiftKey(currentKey, -1);

    // If today isn't checked off yet, start counting from yesterday.
    let cursorKey = checkinDays.has(currentKey) ? currentKey : yesterdayKey;
    let streak = 0;
    while (checkinDays.has(cursorKey)) {
      streak++;
      cursorKey = shiftKey(cursorKey, -1);
    }

    const sortedDayKeys = Array.from(checkinDays).sort();
    let bestStreak = 0;
    let runLength = 0;
    let previousKey: string | null = null;
    sortedDayKeys.forEach((dayKey) => {
      runLength = previousKey && shiftKey(dayKey, -1) === previousKey ? runLength + 1 : 1;
      bestStreak = Math.max(bestStreak, runLength);
      previousKey = dayKey;
    });

    return {
      streak,
      bestStreak: Math.max(bestStreak, streak),
      missedYesterday: !checkinDays.has(yesterdayKey),
      doneToday: checkinDays.has(currentKey)
    };
  }

  history(habitId: string, days = 90): HistoryDay[] {
    const window = clamp(Math.trunc(days) || 90, 1, 365);
    const checkinDays = new Set(
      this.db.checkins
        .filter((checkIn) => checkIn.habit === habitId && checkIn.done)
        .map((checkIn) => dayKeyOf(new Date(checkIn.date)))
    );

    const currentKey = todayKey();
    const startKey = shiftKey(currentKey, -(window - 1));

    const history: HistoryDay[] = [];
    for (let index = 0; index < window; index++) {
      const key = shiftKey(startKey, index);
      history.push({ date: key, done: checkinDays.has(key) });
    }
    return history;
  }

  trend(weeks = 12): TrendWeek[] {
    const window = clamp(Math.trunc(weeks) || 12, 1, 52);
    const currentKey = todayKey();
    const startKey = shiftKey(currentKey, -(window * 7 - 1));

    const doneCountByWeek = new Array(window).fill(0);
    this.db.checkins
      .filter((checkIn) => checkIn.done)
      .forEach((checkIn) => {
        const dayIndex = daysBetweenKeys(startKey, dayKeyOf(new Date(checkIn.date)));
        const weekIndex = Math.floor(dayIndex / 7);
        if (weekIndex >= 0 && weekIndex < window) doneCountByWeek[weekIndex]++;
      });

    const possiblePerWeek = this.db.habits.length * 7;
    return doneCountByWeek.map((doneCount, index) => ({
      weekStart: shiftKey(startKey, index * 7),
      completionRate: possiblePerWeek ? Math.round((doneCount / possiblePerWeek) * 100) : 0
    }));
  }

  identityStats(habitId: string): IdentityStats {
    const habit = this.db.habits.find((h) => h._id === habitId);
    const sinceKey = shiftKey(todayKey(), -29);

    const provenCount = this.db.checkins.filter(
      (checkIn) =>
        checkIn.habit === habitId &&
        checkIn.done &&
        dayKeyOf(new Date(checkIn.date)) >= sinceKey
    ).length;

    return {
      identity: habit?.identity || '',
      provenCount,
      period: 'last 30 days'
    };
  }

  stacks(): StackChain[] {
    const habits = [...this.db.habits].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );
    const habitsById = new Map<string, Habit>(habits.map((habit) => [habit._id, habit] as [string, Habit]));
    const childrenByParent = new Map<string, Habit[]>();

    habits.forEach((habit) => {
      if (!habit.stackedAfter) return;
      const siblings = childrenByParent.get(habit.stackedAfter) || [];
      siblings.push(habit);
      childrenByParent.set(habit.stackedAfter, siblings);
    });

    const chains: StackChain[] = [];
    const visited = new Set<string>();
    const heads = habits.filter(
      (habit) => !habit.stackedAfter || !habitsById.has(habit.stackedAfter)
    );

    heads.forEach((head) => {
      const chain: string[] = [];
      let current: Habit | undefined = head;
      while (current && !visited.has(current._id)) {
        visited.add(current._id);
        chain.push(current.name);
        const children: Habit[] = childrenByParent.get(current._id) || [];
        current = children.find((child) => !visited.has(child._id));
      }
      if (chain.length) chains.push({ chain });
    });

    habits.forEach((habit) => {
      if (!visited.has(habit._id)) chains.push({ chain: [habit.name] });
    });

    return chains;
  }

  // --- Scorecard ------------------------------------------------------------

  listScorecard(): ScorecardEntry[] {
    return [...this.db.scorecard];
  }

  addScorecardEntry(text: string, rating: ScorecardRating): ScorecardEntry {
    const trimmed = (text || '').trim();
    if (!trimmed) throw new Error('Enter a habit or behavior first');
    if (!RATING_VALUES.includes(rating)) throw new Error('Rating must be +, - or =');

    const entry: ScorecardEntry = {
      _id: newId(),
      text: trimmed,
      rating,
      createdAt: new Date().toISOString()
    };
    this.db.scorecard.push(entry);
    this.save();
    return entry;
  }

  removeScorecardEntry(id: string): ScorecardEntry {
    const index = this.db.scorecard.findIndex((entry) => entry._id === id);
    if (index === -1) throw new Error('Entry not found');
    const [removed] = this.db.scorecard.splice(index, 1);
    this.save();
    return removed;
  }

  // --- Weekly reviews -------------------------------------------------------

  listReviews(): WeeklyReview[] {
    return [...this.db.reviews].sort((a, b) => b.weekStart.localeCompare(a.weekStart));
  }

  getReview(weekStart: string): WeeklyReview {
    return (
      this.db.reviews.find((review) => review.weekStart === weekStart) || {
        weekStart,
        wins: '',
        misses: '',
        tweak: ''
      }
    );
  }

  saveReview(weekStart: string, review: Partial<WeeklyReview>): WeeklyReview {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) throw new Error('Invalid week start');

    const existing = this.db.reviews.find((review) => review.weekStart === weekStart);
    const merged: WeeklyReview = {
      weekStart,
      wins: String(review.wins ?? existing?.wins ?? '').trim(),
      misses: String(review.misses ?? existing?.misses ?? '').trim(),
      tweak: String(review.tweak ?? existing?.tweak ?? '').trim()
    };

    if (existing) {
      Object.assign(existing, merged);
    } else {
      this.db.reviews.push(merged);
    }
    this.save();
    return merged;
  }

  // --- Backup (Settings -> Export / Import) ---------------------------------

  exportSnapshot(): Database & { exportedAt: string } {
    return {
      habits: this.listHabits(),
      checkins: [...this.db.checkins],
      scorecard: this.listScorecard(),
      reviews: this.listReviews(),
      exportedAt: new Date().toISOString()
    };
  }

  importSnapshot(payload: {
    habits?: any[];
    checkins?: any[];
    scorecard?: any[];
    reviews?: any[];
  }): { importedHabits: number; importedCheckins: number; importedScorecard: number; importedReviews: number } {
    let importedHabits = 0;
    let importedCheckins = 0;
    let importedScorecard = 0;
    let importedReviews = 0;

    (payload?.habits || []).forEach((raw) => {
      if (!raw || typeof raw._id !== 'string' || !this.db.habits.some((h) => h._id === raw._id)) {
        if (raw && typeof raw._id === 'string') {
          this.db.habits.push({
            name: String(raw.name || '').trim() || 'Untitled habit',
            identity: String(raw.identity || ''),
            miniVersion: String(raw.miniVersion || ''),
            cue: String(raw.cue || ''),
            reward: String(raw.reward || ''),
            stackedAfter: typeof raw.stackedAfter === 'string' ? raw.stackedAfter : null,
            reminderTime: REMINDER_RE.test(raw.reminderTime || '') ? raw.reminderTime : '',
            kind: raw.kind === 'break' ? 'break' : 'grow',
            _id: raw._id,
            createdAt: raw.createdAt || new Date().toISOString()
          });
          importedHabits++;
        }
      }
    });

    (payload?.checkins || []).forEach((raw) => {
      if (!raw || typeof raw.habit !== 'string' || !raw.date) return;
      const key = dayKeyOf(new Date(raw.date));
      if (Number.isNaN(dateFromKey(key).getTime())) return;
      const duplicate = this.db.checkins.some(
        (checkIn) => checkIn.habit === raw.habit && dayKeyOf(new Date(checkIn.date)) === key
      );
      if (duplicate) return;
      this.db.checkins.push({
        _id: typeof raw._id === 'string' ? raw._id : newId(),
        habit: raw.habit,
        date: new Date(raw.date).toISOString(),
        done: raw.done !== false
      });
      importedCheckins++;
    });

    (payload?.scorecard || []).forEach((raw) => {
      if (!raw || typeof raw._id !== 'string' || this.db.scorecard.some((e) => e._id === raw._id)) return;
      if (!RATING_VALUES.includes(raw.rating)) return;
      this.db.scorecard.push({
        _id: raw._id,
        text: String(raw.text || ''),
        rating: raw.rating,
        createdAt: raw.createdAt || new Date().toISOString()
      });
      importedScorecard++;
    });

    (payload?.reviews || []).forEach((raw) => {
      if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw.weekStart || '')) return;
      if (this.db.reviews.some((review) => review.weekStart === raw.weekStart)) return;
      this.db.reviews.push({
        weekStart: raw.weekStart,
        wins: String(raw.wins || ''),
        misses: String(raw.misses || ''),
        tweak: String(raw.tweak || '')
      });
      importedReviews++;
    });

    this.save();
    return { importedHabits, importedCheckins, importedScorecard, importedReviews };
  }
}
