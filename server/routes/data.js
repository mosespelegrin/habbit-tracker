const express = require("express");
const router = express.Router();
const Habit = require("../models/habit.js");
const CheckIn = require("../models/chekIn.js");
const requireAuth = require("../middleware/auth.js");

router.use(requireAuth);

const sendServerError = (res) => res.status(500).json({ message: "Internal server error" });
const MAX_IMPORT_HABITS = 500;
const MAX_IMPORT_CHECKINS = 20000;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const asBoundedString = (value, maxLength) => (typeof value === "string" ? value.trim().slice(0, maxLength) : "");

router.get("/export", async (req, res) => {
    try {
        const habits = await Habit.find({ owner: req.userId }).lean();
        const habitIds = habits.map((habit) => habit._id);
        const checkins = habitIds.length ? await CheckIn.find({ habit: { $in: habitIds } }).lean() : [];

        res.json({ exportedAt: new Date().toISOString(), habits, checkins });
    } catch (error) {
        console.error("Failed to export data", error);
        sendServerError(res);
    }
});

router.post("/import", async (req, res) => {
    try {
        const habits = Array.isArray(req.body?.habits) ? req.body.habits : null;
        const checkins = Array.isArray(req.body?.checkins) ? req.body.checkins : [];

        if (!habits) {
            return res.status(400).json({ message: "A habits array is required" });
        }

        if (habits.length > MAX_IMPORT_HABITS) {
            return res.status(400).json({ message: `Cannot import more than ${MAX_IMPORT_HABITS} habits at once` });
        }

        if (checkins.length > MAX_IMPORT_CHECKINS) {
            return res.status(400).json({ message: `Cannot import more than ${MAX_IMPORT_CHECKINS} check-ins at once` });
        }

        const idMap = new Map();
        const createdWithStack = [];

        for (const source of habits) {
            const name = asBoundedString(source?.name, 120) || "Imported habit";
            const reminderTime = TIME_PATTERN.test(source?.reminderTime) ? source.reminderTime : "";

            const doc = await Habit.create({
                owner: req.userId,
                name,
                identity: asBoundedString(source?.identity, 240),
                miniVersion: asBoundedString(source?.miniVersion, 120),
                cue: asBoundedString(source?.cue, 160),
                reward: asBoundedString(source?.reward, 160),
                reminderTime
            });

            if (source?._id) idMap.set(String(source._id), doc._id);
            createdWithStack.push({ doc, stackedAfter: source?.stackedAfter });
        }

        for (const { doc, stackedAfter } of createdWithStack) {
            const mappedParent = stackedAfter && idMap.get(String(stackedAfter));
            if (mappedParent) {
                doc.stackedAfter = mappedParent;
                await doc.save();
            }
        }

        let importedCheckins = 0;
        for (const source of checkins) {
            const mappedHabitId = idMap.get(String(source?.habit));
            const parsedDate = source?.date ? new Date(source.date) : null;
            if (!mappedHabitId || !parsedDate || Number.isNaN(parsedDate.getTime())) continue;

            await CheckIn.create({ habit: mappedHabitId, date: parsedDate, done: source?.done !== false });
            importedCheckins++;
        }

        res.status(201).json({ importedHabits: createdWithStack.length, importedCheckins });
    } catch (error) {
        console.error("Failed to import data", error);
        res.status(400).json({ message: "Invalid import data" });
    }
});

module.exports = router;
