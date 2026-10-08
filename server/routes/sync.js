const express = require("express");
const router = express.Router();
const Habit = require("../models/habit.js");
const CheckIn = require("../models/chekIn.js");
const ScorecardEntry = require("../models/scorecardEntry.js");
const WeeklyReview = require("../models/weeklyReview.js");
const requireAuth = require("../middleware/auth.js");

router.use(requireAuth);

/**
 * Offline-first sync endpoint (one round trip).
 *
 * The client is always local-first: it keeps habits, check-ins, the scorecard and weekly
 * reviews in its own storage and never blocks on the network. When it comes online it POSTs
 * its whole dataset here. This route:
 *   1. applies deletions the client made while offline (habit deletion cascades to check-ins),
 *   2. upserts every record by client-generated _id using last-writer-wins on `updatedAt`,
 *   3. responds with the authoritative merged dataset, which the client merges the same way.
 *
 * Client ids are 24-hex strings, so they are valid ObjectIds and can be used directly as
 * MongoDB primary keys - no id remapping needed, and sync is idempotent (safe to retry).
 */

const MAX = { habits: 500, checkins: 20000, scorecard: 2000, reviews: 520 };
const OBJECT_ID = /^[a-f\d]{24}$/i;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const asId = (value) => (typeof value === "string" && OBJECT_ID.test(value) ? value : null);
const asText = (value, maxLength) => (typeof value === "string" ? value.trim().slice(0, maxLength) : "");
const asDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};
const isDuplicateKey = (error) =>
    error && (error.code === 11000 || (Array.isArray(error.writeErrors) && error.writeErrors.every((write) => write.err && write.err.code === 11000)));

router.post("/", async (req, res) => {
    try {
        const body = req.body || {};
        const habits = Array.isArray(body.habits) ? body.habits : [];
        const checkins = Array.isArray(body.checkins) ? body.checkins : [];
        const scorecard = Array.isArray(body.scorecard) ? body.scorecard : [];
        const reviews = Array.isArray(body.reviews) ? body.reviews : [];
        const deleted = body.deleted || {};
        const deletedHabits = Array.isArray(deleted.habits) ? deleted.habits.map(asId).filter(Boolean) : [];
        const deletedScorecard = Array.isArray(deleted.scorecard) ? deleted.scorecard.map(asId).filter(Boolean) : [];

        if (
            habits.length > MAX.habits ||
            checkins.length > MAX.checkins ||
            scorecard.length > MAX.scorecard ||
            reviews.length > MAX.reviews ||
            deletedHabits.length > MAX.habits ||
            deletedScorecard.length > MAX.scorecard
        ) {
            return res.status(400).json({ message: "Sync payload exceeds the allowed limits" });
        }

        // --- 1. Deletions (made offline) -------------------------------------
        if (deletedHabits.length) {
            await Habit.deleteMany({ _id: { $in: deletedHabits }, owner: req.userId });
            await CheckIn.deleteMany({ habit: { $in: deletedHabits } });
        }
        if (deletedScorecard.length) {
            await ScorecardEntry.deleteMany({ _id: { $in: deletedScorecard }, owner: req.userId });
        }

        // --- 2. Habits: upsert by _id, last writer wins ----------------------
        for (const source of habits) {
            const id = asId(source?._id);
            const name = asText(source?.name, 120);
            if (!id || !name) continue;

            const incomingAt = asDate(source.updatedAt) || asDate(source.createdAt) || new Date();
            const fields = {
                name,
                identity: asText(source.identity, 240),
                miniVersion: asText(source.miniVersion, 120),
                cue: asText(source.cue, 160),
                reward: asText(source.reward, 160),
                reminderTime: TIME_PATTERN.test(source.reminderTime || "") ? source.reminderTime : "",
                kind: source.kind === "break" ? "break" : "grow",
                stackedAfter: asId(source.stackedAfter),
                updatedAt: incomingAt
            };

            const existing = await Habit.findOne({ _id: id, owner: req.userId });
            if (!existing) {
                try {
                    await Habit.create({
                        ...fields,
                        _id: id,
                        owner: req.userId,
                        createdAt: asDate(source.createdAt) || incomingAt
                    });
                } catch (error) {
                    if (!isDuplicateKey(error)) throw error;
                }
            } else if (!existing.updatedAt || incomingAt > existing.updatedAt) {
                Object.assign(existing, fields);
                await existing.save();
            }
        }

        // --- 3. Check-ins: append-only, insert the ids we don't have yet -----
        const ownedHabits = await Habit.find({ owner: req.userId }).select("_id");
        const ownedHabitIdSet = new Set(ownedHabits.map((habit) => String(habit._id)));

        const checkinSources = checkins
            .map((source) => ({
                id: asId(source?._id),
                habit: asId(source?.habit),
                date: asDate(source?.date),
                done: source?.done !== false,
                updatedAt: asDate(source?.updatedAt)
            }))
            .filter((source) => source.id && source.habit && source.date && ownedHabitIdSet.has(source.habit));

        if (checkinSources.length) {
            const existingCheckins = await CheckIn.find({ _id: { $in: checkinSources.map((source) => source.id) } }).select("_id");
            const alreadySynced = new Set(existingCheckins.map((checkin) => String(checkin._id)));

            const toInsert = checkinSources
                .filter((source) => !alreadySynced.has(source.id))
                .map((source) => ({
                    _id: source.id,
                    habit: source.habit,
                    date: source.date,
                    done: source.done,
                    updatedAt: source.updatedAt || source.date
                }));

            if (toInsert.length) {
                try {
                    await CheckIn.insertMany(toInsert, { ordered: false });
                } catch (error) {
                    // Concurrent sync from two devices can race on the same _id - duplicates are fine.
                    if (!isDuplicateKey(error)) throw error;
                }
            }
        }

        // --- 4. Scorecard: upsert by _id, last writer wins -------------------
        const scorecardSources = scorecard
            .map((source) => ({
                id: asId(source?._id),
                text: asText(source?.text, 160),
                rating: ["positive", "negative", "neutral"].includes(source?.rating) ? source.rating : null,
                createdAt: asDate(source?.createdAt),
                updatedAt: asDate(source?.updatedAt)
            }))
            .filter((source) => source.id && source.text && source.rating);

        if (scorecardSources.length) {
            const existingEntries = await ScorecardEntry.find({
                _id: { $in: scorecardSources.map((source) => source.id) },
                owner: req.userId
            }).select("_id updatedAt");
            const existingById = new Map(existingEntries.map((entry) => [String(entry._id), entry]));

            const toInsert = [];
            const toUpdate = [];
            for (const source of scorecardSources) {
                const existing = existingById.get(source.id);
                const incomingAt = source.updatedAt || source.createdAt || new Date();
                if (!existing) {
                    toInsert.push({
                        _id: source.id,
                        owner: req.userId,
                        text: source.text,
                        rating: source.rating,
                        createdAt: source.createdAt || incomingAt,
                        updatedAt: incomingAt
                    });
                } else if (!existing.updatedAt || incomingAt > existing.updatedAt) {
                    toUpdate.push({
                        updateOne: {
                            filter: { _id: source.id, owner: req.userId },
                            update: { $set: { text: source.text, rating: source.rating, updatedAt: incomingAt } }
                        }
                    });
                }
            }

            if (toInsert.length) {
                try {
                    await ScorecardEntry.insertMany(toInsert, { ordered: false });
                } catch (error) {
                    if (!isDuplicateKey(error)) throw error;
                }
            }
            if (toUpdate.length) await ScorecardEntry.bulkWrite(toUpdate, { ordered: false });
        }

        // --- 5. Weekly reviews: unique per (owner, weekStart) ----------------
        for (const source of reviews) {
            const weekStart = typeof source?.weekStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(source.weekStart)
                ? source.weekStart
                : null;
            if (!weekStart) continue;

            const incomingAt = asDate(source.updatedAt) || new Date();
            const fields = {
                wins: asText(source.wins, 1000),
                misses: asText(source.misses, 1000),
                tweak: asText(source.tweak, 1000),
                updatedAt: incomingAt
            };

            const existing = await WeeklyReview.findOne({ owner: req.userId, weekStart });
            if (!existing) {
                try {
                    await WeeklyReview.create({ owner: req.userId, weekStart, ...fields });
                } catch (error) {
                    if (!isDuplicateKey(error)) throw error;
                }
            } else if (!existing.updatedAt || incomingAt > existing.updatedAt) {
                Object.assign(existing, fields);
                await existing.save();
            }
        }

        // --- 6. Respond with the authoritative merged state ------------------
        const habitsOut = await Habit.find({ owner: req.userId }).lean();
        const habitIds = habitsOut.map((habit) => habit._id);
        const checkinsOut = habitIds.length ? await CheckIn.find({ habit: { $in: habitIds } }).lean() : [];
        const scorecardOut = await ScorecardEntry.find({ owner: req.userId }).lean();
        const reviewsOut = await WeeklyReview.find({ owner: req.userId }).lean();

        res.json({
            habits: habitsOut,
            checkins: checkinsOut,
            scorecard: scorecardOut,
            reviews: reviewsOut,
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error("Sync failed", error);
        res.status(500).json({ message: "Sync failed. Your data is safe locally - try again." });
    }
});

module.exports = router;
