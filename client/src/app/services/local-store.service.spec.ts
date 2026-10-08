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

  // --- Cloud sync (updatedAt, tombstones, last-writer-wins merge) -----------

  it('records tombstones for local deletions and acknowledges them on sync', () => {
    const habit = service.createHabit({ name: 'Soda' });
    service.addScorecardEntry('Late-night snacking', 'negative');

    service.deleteHabit(habit._id);
    expect(service.pendingDeletions().habits).toContain(habit._id);

    const scorecardId = service.listScorecard()[0]._id;
    service.removeScorecardEntry(scorecardId);
    expect(service.pendingDeletions().scorecard).toContain(scorecardId);

    // The server acknowledges exactly what we sent; anything newer survives.
    service.clearTombstones({ habits: [habit._id] });
    expect(service.pendingDeletions().habits).toEqual([]);
    expect(service.pendingDeletions().scorecard).toEqual([scorecardId]);
  });

  it('clears a pending tombstone when the id is imported back', () => {
    const habit = service.createHabit({ name: 'Soda' });
    service.deleteHabit(habit._id);
    service.importSnapshot({ habits: [habit], checkins: [] });
    expect(service.pendingDeletions().habits).toEqual([]);
    expect(service.listHabits().length).toBe(1);
  });

  it('merges a sync response: new habits land, duplicate check-ins are skipped', () => {
    const local = service.createHabit({ name: 'Read' });
    service.checkIn(local._id);

    // A habit that exists only on the server (created on another device) must be added locally.
    const remoteHabit = {
      _id: 'cc33cc33cc33cc33cc33cc33',
      name: 'Gym',
      identity: '',
      miniVersion: '',
      cue: '',
      reward: '',
      stackedAfter: null,
      reminderTime: '',
      kind: 'grow',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const incomingCheckin = {
      _id: 'aaaa11111111111111111111',
      habit: remoteHabit._id,
      date: new Date().toISOString(),
      done: true,
      updatedAt: new Date().toISOString()
    };
    const counts = service.mergeServerResponse({
      habits: [remoteHabit, local],
      checkins: [incomingCheckin],
      scorecard: [{ _id: 'bbbb22222222222222222222', text: 'Phone in bed', rating: 'negative', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      reviews: [{ weekStart: '2026-10-05', wins: 'Won the week', misses: '', tweak: '', updatedAt: new Date().toISOString() }]
    });

    expect(counts.habits).toBe(1); // only the server-only habit was new
    expect(counts.checkins).toBe(1);
    expect(counts.scorecard).toBe(1);
    expect(counts.reviews).toBe(1);
    expect(service.listHabits().length).toBe(2);
    expect(service.listScorecard().length).toBe(1);

    // The same sync response retried is a no-op (idempotent upsert).
    const retry = service.mergeServerResponse({ habits: [], checkins: [incomingCheckin], scorecard: [], reviews: [] });
    expect(retry.habits).toBe(0);
    expect(retry.checkins).toBe(0);
    expect(retry.scorecard).toBe(0);
  });

  it('keeps the newer record on a conflict (last writer wins)', () => {
    const habit = service.createHabit({ name: 'Read' });
    const older = new Date(Date.now() - 60_000).toISOString(); // local is newer
    const newer = new Date(Date.now() + 60_000).toISOString();

    // Server has an older version -> local keeps its own (name stays).
    const countsOlder = service.mergeServerResponse({
      habits: [{ _id: habit._id, name: 'Stale name', updatedAt: older }],
      checkins: [], scorecard: [], reviews: []
    });
    expect(countsOlder.habits).toBe(0);
    expect(service.listHabits()[0].name).toBe('Read');

    // Server has a newer version -> the local copy is replaced.
    const countsNewer = service.mergeServerResponse({
      habits: [{ _id: habit._id, name: 'Fresh name', updatedAt: newer }],
      checkins: [], scorecard: [], reviews: []
    });
    expect(countsNewer.habits).toBe(1);
    expect(service.listHabits()[0].name).toBe('Fresh name');
  });

  it('does not resurrect records that were deleted on this device', () => {
    const habit = service.createHabit({ name: 'Soda' });
    service.deleteHabit(habit._id);

    service.mergeServerResponse({
      habits: [{ _id: habit._id, name: 'Soda', updatedAt: new Date(Date.now() + 60_000).toISOString() }],
      checkins: [], scorecard: [], reviews: []
    });
    expect(service.listHabits().length).toBe(0);
  });

  it('backfills updatedAt for pre-sync databases and stamps it on edits', () => {
    // Simulate an old database written before updatedAt existed.
    const habit = service.createHabit({ name: 'Legacy' });
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    delete raw.habits[0].updatedAt;
    raw.deleted = undefined;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));

    const fresh = new LocalStoreService();
    const loaded = fresh.listHabits()[0];
    expect(loaded.updatedAt).toBe(loaded.createdAt);

    const edited = fresh.updateHabit(loaded._id, { reward: 'Coffee' });
    // updatedAt is stamped with the edit time; >= guards against same-millisecond edits.
    expect(edited.updatedAt.length).toBe(24);
    expect(new Date(edited.updatedAt).getTime()).not.toBeLessThan(new Date(loaded.updatedAt).getTime());
  });
});
