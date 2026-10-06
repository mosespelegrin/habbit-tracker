// Calendar-day helpers that work in the *user's* timezone rather than the server's.
// Hosts usually run in UTC, so `setHours(0,0,0,0)` would roll a user's "today" over at the wrong local time.

const DAY_MS = 24 * 60 * 60 * 1000;

const isValidTimeZone = (timeZone) => {
    if (typeof timeZone !== "string" || !timeZone || timeZone.length > 64) return false;

    try {
        new Intl.DateTimeFormat("en-CA", { timeZone });
        return true;
    } catch {
        return false;
    }
};

// The Angular client sends its IANA zone (e.g. "Asia/Manila") on every request as `X-Timezone`.
const requestTimeZone = (req) => {
    const header = req.get("x-timezone");
    return isValidTimeZone(header) ? header : "UTC";
};

// "YYYY-MM-DD" for the calendar day `date` falls on in `timeZone`.
const dateKeyInZone = (date, timeZone) =>
    new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

const keyToUtcMs = (key) => {
    const [year, month, day] = key.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
};

// Calendar arithmetic on date keys (no DST involved because it runs on UTC midnights).
const shiftDateKey = (key, days) => new Date(keyToUtcMs(key) + days * DAY_MS).toISOString().slice(0, 10);

const daysBetweenKeys = (fromKey, toKey) => Math.round((keyToUtcMs(toKey) - keyToUtcMs(fromKey)) / DAY_MS);

// Earliest instant that could still belong to `key` in any timezone (UTC-12 .. UTC+14), so a DB query
// using it as a lower bound never misses a check-in; callers then filter precisely by date key.
const earliestInstantForKey = (key) => new Date(keyToUtcMs(key) - DAY_MS);

module.exports = {
    DAY_MS,
    isValidTimeZone,
    requestTimeZone,
    dateKeyInZone,
    shiftDateKey,
    daysBetweenKeys,
    earliestInstantForKey
};
