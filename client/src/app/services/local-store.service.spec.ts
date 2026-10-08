import { LocalStoreService, Habit } from './local-store.service';

const STORAGE_KEY = 'atomicOfflineDb.v1';

/** ISO timestamp for n days ago (same local-calendar day the store will read back). */
const daysAgo = (n: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - n);
  return date.toISOString();
};

describe('LocalStoreService', () => {
  let service: LocalStoreService;

  beforeEach(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* private mode */ }
    service = new LocalStoreService();
  });

  it('creates habits with a default kind of grow and supports break habits', () => {
    const grow = service.createHabit({ name: 'Read' });
    const breaking = service.createHabit({ name: 'Stop scrolling', kind: 'break' });

    expect(grow.kind).toBe('grow');
    expect(breaking.kind).toBe('break');
    expect(grow._id).toMatch(/^[a-f0-9]{24}$/);
  });

  it('rejects invalid habit input with the server wording', () => {
    expect(() => service.createHabit({ name: '   ' })).toThrowError('Name cannot be empty');
    expect(() => service.createHabit({ name: 'Gym', reminderTime: '25:99' }))
      .toThrowError('reminderTime must be in HH:MM 24-hour format');
  });

  it('rejects a duplicate check-in for the same day', () => {
    const habit = service.createHabit({ name: 'Stretch' });
    service.checkIn(habit._id);
    expect(() => service.checkIn(habit._id))
      .toThrowError('Check-in already exists for this habit today');
  });

  it('computes streaks, best streak and never-miss-twice flags', () => {
    const habit = service.createHabit({ name: 'Walk' });
    service.importSnapshot({
      habits: [],
      checkins: [
        { habit: habit._id, date: daysAgo(3), done: true },
        { habit: habit._id, date: daysAgo(2), done: true },
        { habit: habit._id, date: daysAgo(1), done: true }
      ]
    });

    // Today and yesterday untouched: streak counts back through yesterday, then stops at the gap.
    const before = service.streaks(habit._id);
    expect(before.streak).toBe(3);
    expect(before.doneToday).toBe(false);
    expect(before.missedYesterday).toBe(false);

    // Checking in today extends the chain.
    service.checkIn(habit._id);
    const after = service.streaks(habit._id);
    expect(after.streak).toBe(4);
    expect(after.doneToday).toBe(true);
    expect(after.bestStreak).toBe(4);
  });

  it('flags a broken chain as never-miss-twice danger', () => {
    const habit = service.createHabit({ name: 'Meditate' });
    service.importSnapshot({
      habits: [],
      checkins: [{ habit: habit._id, date: daysAgo(2), done: true }]
    });

    const streak = service.streaks(habit._id);
    expect(streak.streak).toBe(0);
    expect(streak.missedYesterday).toBe(true);
    expect(streak.doneToday).toBe(false);
    expect(streak.bestStreak).toBe(1);
  });

  it('exports and re-imports a backup without duplicating rows', () => {
    const habit = service.createHabit({ name: 'Journal' });
    service.checkIn(habit._id);
    service.addScorecardEntry('Checking my phone after waking', 'negative');
    service.saveReview('2026-10-05', { wins: 'Kept the streak', misses: 'Skipped Friday', tweak: 'Move it to morning' });

    const snapshot = service.exportSnapshot();
    expect(snapshot.habits.length).toBe(1);
    expect(snapshot.checkins.length).toBe(1);
    expect(snapshot.scorecard.length).toBe(1);
    expect(snapshot.reviews.length).toBe(1);

    const second = service.importSnapshot(snapshot);
    expect(second.importedHabits).toBe(0);
    expect(second.importedCheckins).toBe(0);
    expect(second.importedScorecard).toBe(0);
    expect(second.importedReviews).toBe(0);

    const fresh = new LocalStoreService(); // reloads from localStorage
    expect(fresh.listHabits().length).toBe(1);
    expect(fresh.streaks(habit._id).doneToday).toBe(true);
    expect(fresh.getReview('2026-10-05').tweak).toBe('Move it to morning');
  });

  it('keeps partial habit updates from blanking untouched fields', () => {
    const habit = service.createHabit({
      name: 'Read',
      cue: 'After breakfast',
      reward: 'A coffee',
      reminderTime: '08:30'
    });

    const updated = service.updateHabit(habit._id, { reward: 'Ten quiet minutes' });
    expect(updated.reward).toBe('Ten quiet minutes');
    expect(updated.cue).toBe('After breakfast');
    expect(updated.reminderTime).toBe('08:30');
    expect(updated.name).toBe('Read');
  });

  it('deleting a habit removes its check-ins', () => {
    const habit = service.createHabit({ name: 'Plank' });
    service.checkIn(habit._id);
    service.deleteHabit(habit._id);

    expect(service.listHabits().length).toBe(0);
    expect(service.history(habit._id, 30).every((day) => !day.done)).toBe(true);
  });
});
