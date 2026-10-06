const express=require("express");
const router=express.Router();
const mongoose=require("mongoose");
const Habit=require("../models/habit.js");
const CheckIn = require("../models/chekIn.js");
const requireAuth=require("../middleware/auth.js");
const {
    DAY_MS,
    requestTimeZone,
    dateKeyInZone,
    shiftDateKey,
    daysBetweenKeys,
    earliestInstantForKey
} = require("../utils/timezone.js");

router.use(requireAuth);

const isValidObjectId=(id)=>typeof id==="string" && /^[a-f\d]{24}$/i.test(id) && mongoose.Types.ObjectId.isValid(id);
const sendServerError=(res)=>{
    res.status(500).json({message:"Internal server error"});
};

router.get("/trend", async (req, res) => {
    try {
        const requestedWeeks = parseInt(req.query.weeks, 10) || 12;
        const weeks = Math.min(Math.max(requestedWeeks, 1), 52);
        const timeZone = requestTimeZone(req);

        const habits = await Habit.find({ owner: req.userId }).select("_id");
        const habitIds = habits.map((habit) => habit._id);

        const todayKey = dateKeyInZone(new Date(), timeZone);
        const startKey = shiftDateKey(todayKey, -(weeks * 7 - 1));

        const checkins = habitIds.length
            ? await CheckIn.find({ habit: { $in: habitIds }, done: true, date: { $gte: earliestInstantForKey(startKey) } }).select("date")
            : [];

        const doneCountByWeek = new Array(weeks).fill(0);
        checkins.forEach((checkin) => {
            const dayIndex = daysBetweenKeys(startKey, dateKeyInZone(checkin.date, timeZone));
            const weekIndex = Math.floor(dayIndex / 7);
            if (weekIndex >= 0 && weekIndex < weeks) doneCountByWeek[weekIndex]++;
        });

        const possiblePerWeek = habitIds.length * 7;
        const trend = doneCountByWeek.map((doneCount, index) => ({
            weekStart: shiftDateKey(startKey, index * 7),
            completionRate: possiblePerWeek ? Math.round((doneCount / possiblePerWeek) * 100) : 0
        }));

        res.json(trend);
    } catch (error) {
        console.error("Failed to load completion trend", error);
        sendServerError(res);
    }
});

router.get("/history/:habitId", async (req, res) => {
    if(!isValidObjectId(req.params.habitId)){
        return res.status(400).json({message:"Invalid habit id"});
    }

    try {
        const habitExists=await Habit.exists({_id:req.params.habitId,owner:req.userId});
        if(!habitExists){
            return res.status(404).json({message:"Habit not found"});
        }

        const requestedDays = parseInt(req.query.days, 10) || 90;
        const days = Math.min(Math.max(requestedDays, 1), 365);
        const timeZone = requestTimeZone(req);

        const todayKey = dateKeyInZone(new Date(), timeZone);
        const startKey = shiftDateKey(todayKey, -(days - 1));

        const checkins = await CheckIn.find({
            habit: req.params.habitId,
            done: true,
            date: { $gte: earliestInstantForKey(startKey) }
        }).select("date");

        const checkinDays = new Set(checkins.map((checkin) => dateKeyInZone(checkin.date, timeZone)));
        const history = [];

        for (let index = 0; index < days; index++) {
            const dateKey = shiftDateKey(startKey, index);

            history.push({
                date: dateKey,
                done: checkinDays.has(dateKey)
            });
        }

        res.json(history);
    } catch (error) {
        console.error("Failed to load check-in history",error);
        sendServerError(res);
    }
});

router.post("/:habitId/",async(req,res)=>{
    if(!isValidObjectId(req.params.habitId)){
        return res.status(400).json({message:"Invalid habit id"});
    }

    try{
        const habitExists=await Habit.exists({_id:req.params.habitId,owner:req.userId});
        if(!habitExists){
            return res.status(404).json({message:"Habit not found"});
        }

        const timeZone = requestTimeZone(req);
        const now = new Date();
        const todayKey = dateKeyInZone(now, timeZone);

        // "Today" in the user's zone spans at most ~2 UTC days, so look back that far and match by date key.
        const recentCheckIns=await CheckIn.find({
            habit:req.params.habitId,
            date:{ $gte: new Date(now.getTime() - 2 * DAY_MS) }
        }).select("date");

        if (recentCheckIns.some((checkIn) => dateKeyInZone(checkIn.date, timeZone) === todayKey)) {
            return res.status(400).json({ message: "Check-in already exists for this habit today" });
        }

        const newCheckIn = new CheckIn({
                habit: req.params.habitId,
                date: now,
                done: true
            });
        const savedCheckIn = await newCheckIn.save();
        res.status(201).json(savedCheckIn);
    } catch (error) {
        console.error("Failed to create check-in",error);
        res.status(400).json({ message: "Invalid check-in data" });
    }
});


router.get("/streaks/:habitId", async (req, res) => {
    if(!isValidObjectId(req.params.habitId)){
        return res.status(400).json({message:"Invalid habit id"});
    }

    try {
        const habitExists=await Habit.exists({_id:req.params.habitId,owner:req.userId});
        if(!habitExists){
            return res.status(404).json({message:"Habit not found"});
        }

        const timeZone = requestTimeZone(req);
        const checkins = await CheckIn.find({
            habit: req.params.habitId,
            done: true
        }).select("date");

        // Fast lookup set: "was this habit done on this calendar day (in the user's timezone)?"
        const checkinDays = new Set(checkins.map((c) => dateKeyInZone(c.date, timeZone)));

        const todayKey = dateKeyInZone(new Date(), timeZone);
        const yesterdayKey = shiftDateKey(todayKey, -1);

        // If today isn't checked off yet, start counting from yesterday
        let cursorKey = checkinDays.has(todayKey) ? todayKey : yesterdayKey;
        let streak = 0;

        // Walk backward one day at a time, stop at first gap
        while (checkinDays.has(cursorKey)) {
            streak++;
            cursorKey = shiftDateKey(cursorKey, -1);
        }

        // Best streak ever: sort the distinct done-days and find the longest run of consecutive days
        const sortedDayKeys = Array.from(checkinDays).sort();
        let bestStreak = 0;
        let runLength = 0;
        let previousKey = null;

        sortedDayKeys.forEach((dayKey) => {
            runLength = previousKey && shiftDateKey(dayKey, -1) === previousKey ? runLength + 1 : 1;
            bestStreak = Math.max(bestStreak, runLength);
            previousKey = dayKey;
        });

        res.json({
            streak,
            bestStreak: Math.max(bestStreak, streak),
            missedYesterday: !checkinDays.has(yesterdayKey),
            doneToday: checkinDays.has(todayKey)
        });

    } catch (error) {
        console.error("Failed to load streaks",error);
        sendServerError(res);
    }
});

module.exports = router;
