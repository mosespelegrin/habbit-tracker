# Atomic — Feature Guide: why each feature exists

Every feature in Atomic maps to an idea from James Clear's *Atomic Habits*. This guide pairs the feature with the exact quote that justifies it, so you (and your users) always know *why* it is there.

> All quotes verified against jamesclear.com — the author's own *Atomic Habits* quotes archive (`/atomic-habits-quotes`) and summary (`/atomic-habits-summary`). The six quotes that also appear inside the app itself are marked **(in-app)**.

---

## 1. The thesis

> "Habits are the compound interest of self-improvement." — James Clear, *Atomic Habits* **(in-app)**

Small daily votes, repeated, beat one big push. The whole app is built around showing that compounding.

**Where it lives:** the tagline on the title slide, the level/XP system, the goal ring.

---

## 2. Identity — every check-in is a vote

> "Every action you take is a vote for the type of person you wish to become." — James Clear, *Atomic Habits* (p. 38) **(in-app)**

You write the identity — "I am a reader" — and every check-in is logged as evidence.

**In the app:** the `identity` field on every habit + the "Proven 12× this month" badge. The dashboard (`/`) proves the vote count.

---

## 3. The Four Laws — four fields on every habit

> "How can I make it obvious? How can I make it attractive? How can I make it easy? How can I make it satisfying?" — James Clear, framing the Four Laws
>
> 1. Cue → Make it obvious · 2. Craving → Make it attractive · 3. Response → Make it easy · 4. Reward → Make it satisfying

One habit form *is* the four laws:

| Law | Field in the app |
|-----|------------------|
| Make it obvious | **Cue** — when and where ("After breakfast, I read") |
| Make it attractive | **Identity + reward** — who you become, what you get to enjoy after |
| Make it easy | **2-minute version** — "Read 1 page" |
| Make it satisfying | **Check it off → streak + XP + goal ring fill instantly** |

---

## 4. Start absurdly small — the 2-minute version

> "All big things come from small beginnings. The seed of every habit is a single, tiny decision." — James Clear, *Atomic Habits* (p. 22)

> The book's rule of thumb: a new habit should take less than two minutes to do.

**In the app:** the `miniVersion` field and the mini-version toggle on the Habits page. It swaps "Read 10 pages" → "Read 1 page" on your home screen until the identity sticks. Beside it sits the cue, so the smallest version is always the obvious next move. Miss the big one, do the small one: the chain survives.

---

## 5. Habit stacking — one habit hitched to another

> "After [CURRENT HABIT], I will [NEW HABIT]." — the habit-stacking formula, *Atomic Habits*

**In the app:** the `stacks` chain on each habit, rendered as "Stacks" on the Habits page. Example: *After I pour my coffee → Read 10 pages (reward: a fresh chapter)*.

---

## 6. Streaks — miss once, never twice

> "Missing once is an accident. Missing twice is the start of a new habit." — James Clear, *Atomic Habits*

> The book's shorthand for the same idea: *never miss twice.*

**In the app:** current streak, personal best, a 90-day heatmap, and a one-tap "Done today" button. A gap shows up as something you can feel — the app never lets day two become the new normal.

---

## 7. Daily scorecard — rate the day, not the dream

> "Success is the product of daily habits — not once-in-a-lifetime transformations." — James Clear, *Atomic Habits* **(in-app)**

From chapter 1: every evening, + if it moved you forward, − if it set you back, = if you stayed level.

**In the app:** Scorecard page (`/scorecard`). + / − / = per entry. The weekly pattern is what the Weekly Review reads.

---

## 8. Trajectory over results — the 12-week trend

> "You should be far more concerned with your current trajectory than with your current results." — James Clear, *Atomic Habits* **(in-app)**

**In the app:** the 12-week completion trend chart on Trends, plus Level/XP and the goal ring. They measure the system *while it runs* — not one Monday morning. A missed day barely bends the curve; showing up compounds it.

---

## 9. Reminders — explain first, then notify

> "The most practical way to change who you are is to change what you do." — James Clear, *Atomic Habits* **(in-app)**

Reminders make you *do*.

**In the app:** per-habit `reminderTime`, scheduled as native local notifications on the device — nothing leaves the phone. On Android 13+ the app never requests `POST_NOTIFICATIONS` cold:
1. Settings → Enable reminders shows an in-app rationale (what it is for, that it stays on-device).
2. Only tapping **Continue** there opens the system dialog.
3. Settings always shows the permission status (Allowed / Not asked yet / Blocked) and how to re-enable it if blocked. The schedule is rebuilt every time the habit list loads.

---

## 10. Weekly review — one small tweak

> "In order to improve for good, you need to solve problems at the systems level. Fix the inputs and the outputs will fix themselves." — James Clear, *Atomic Habits*

**In the app:** Review page (`/review`). Five minutes: what won, what slipped, and exactly **one** change — never two. Example: *Move the gym cue to 07:00, before work can negotiate.*

---

## 11. Designed to be calm — and trustworthy

> "The more disciplined your environment is, the less disciplined you need to be." — James Clear

The interface *is* the disciplined environment.

**In the app:**
- **Glass, not glare** — frosted panels over a morning-haze backdrop, teal pill buttons, dark + light themes, contrast tuned to WCAG AA (see `client/src/styles.css` tokens).
- **Private by default** — plain-language "Offline mode" notice in Settings; what is stored (habits, check-ins, scorecard, reviews), where (this device only, nothing uploaded), and the fact nothing tracks you. Export everything as JSON any time.
- **Accessible** — 44 px touch targets, visible focus rings, live regions for errors, `prefers-reduced-motion` respected.
- **Hard to misuse** — no account to phish or leak (pure offline, no network calls), and a two-step confirm on anything destructive (delete arms for 5 s, no `window.confirm()`).

---

## 12. The system beats the goal

> "You do not rise to the level of your goals. You fall to the level of your systems." — James Clear, *Atomic Habits* **(in-app)** — also shown on the app's home screen

> Companion line, same idea: "Goals are good for setting a direction, but systems are best for making progress."

**In the app:** the app *is* the system. That is the closing line of the deck, and the promise the Workflow page keeps — Awareness → Design → Do → Reflect, with the scorecard feeding each step.

---

## 13. Grow *and* break — every habit gets a direction

> "The task of breaking a bad habit is like uprooting a powerful oak within us. And the task of building a good habit is like cultivating a delicate flower one day at a time." — James Clear, *Atomic Habits* (verified on jamesclear.com/atomic-habits-quotes)

> "In the long-run (and often in the short-run), your willpower will never beat your environment. The more disciplined your environment is, the less disciplined you need to be. Don't swim upstream." — James Clear (verified, 3-2-1 Newsletter, Nov 27 2025)

Chapter 5 says the same four laws, run backwards, dismantle a bad habit. So every habit in the app now carries a **direction**:

**In the app:**
- **Grow (4 Laws)** — the existing fields: Cue (obvious), Identity (attractive), 2-minute version (easy), Reward (satisfying).
- **Break (inverse Laws)** — same fields, opposite job: *Cue → make it invisible* (remove the trigger), *Identity → make it unattractive* (who you'd become without it), *Friction → make it difficult* (the 20-second rule), *Contract → make it unsatisfying* (someone else is watching).
- **Design (Workflow Step 2)** has a Grow/Break toggle; a `−` scorecard entry pre-fills a break habit automatically.
- **Check-ins flip vocabulary** — break habits show a BREAK badge and the button says **"I resisted today"**; resisting is the vote that counts.
- **Reference card** on the Habits page lists both sets of laws side by side.

---

## 14. Pure offline — the disciplined environment, now local

> "The more disciplined your environment is, the less disciplined you need to be." — James Clear (verified, 3-2-1 Newsletter, Nov 27 2025)

**In the app:**
- Everything lives on-device (`LocalStoreService`): no login, no server, no network — works in airplane mode.
- Streak math, history, trend, stacks and duplicate check-in protection behave exactly like the old API, reimplemented locally and covered by 13 unit specs.
- Settings → Backup exports/imports the whole store as JSON (dedupe on import), so the local copy is still yours to move.

---

## Slides

The deck that walks through the same mapping, one feature per slide with screenshots and the app icon, is at:

- `docs/Atomic-Features-Deck.pptx` (in the repo)
- `C:\Users\admin\Desktop\Atomic-Features-Deck.pptx` (copy on your Desktop for presenting)

Build it from source: `cd` to `C:\Users\admin\AppData\Local\Temp\opencode\deck` → `node build-deck.js` (requires `pptxgenjs`).

## Icon

The new launcher icon is at `client/assets/icon.svg` (vector source) and `client/assets/icon.png` (512 px raster, generated by `client/assets/render-icon.js`). After changing the SVG, run:

```bash
node client/assets/render-icon.js
npm run assets:android
npx cap sync android
```

The current icon — a teal atom with a checkmark nucleus over the app's morning-haze gradient — ships in the APK on your Desktop (`Atomic-habit-tracker.apk`, 6.42 MB, 2026-10-06 22:39).
