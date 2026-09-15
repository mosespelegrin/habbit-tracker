const express=require("express");
const router=express.Router();
const mongoose=require("mongoose");
const Habit=require("../models/habit.js");
const CheckIn = require("../models/chekIn.js");
const requireAuth=require("../middleware/auth.js");

router.use(requireAuth);

const isValidObjectId=(id)=>typeof id==="string" && /^[a-f\d]{24}$/i.test(id) && mongoose.Types.ObjectId.isValid(id);
const sendServerError=(res)=>{
    res.status(500).json({message:"Internal server error"});
};

const toDateKey = (date) => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    const year = normalized.getFullYear();
    const month = String(normalized.getMonth() + 1).padStart(2, "0");
    const day = String(normalized.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

router.get("/trend", async (req, res) => {
    try {
        const requestedWeeks = parseInt(req.query.weeks, 10) || 12;
        const weeks = Math.min(Math.max(requestedWeeks, 1), 52);

        const habits = await Habit.find({ owner: req.userId }).select("_id");
        const habitIds = habits.map((habit) => habit._id);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = new Date(today);
        start.setDate(start.getDate() - (weeks * 7 - 1));
        const end = new Date(today);
        end.setHours(23, 59, 59, 999);

        const checkins = habitIds.length
            ? await CheckIn.find({ habit: { $in: habitIds }, done: true, date: { $gte: start, $lte: end } }).select("date")
            : [];

        const doneCountByWeek = new Array(weeks).fill(0);
        checkins.forEach((checkin) => {
            const day = new Date(checkin.date);
            day.setHours(0, 0, 0, 0);
            const dayIndex = Math.round((day.getTime() - start.getTime()) / 86400000);
            const weekIndex = Math.floor(dayIndex / 7);
            if (weekIndex >= 0 && weekIndex < weeks) doneCountByWeek[weekIndex]++;
        });

        const possiblePerWeek = habitIds.length * 7;
        const trend = doneCountByWeek.map((doneCount, index) => {
            const weekStart = new Date(start);
            weekStart.setDate(start.getDate() + index * 7);
            return {
                weekStart: toDateKey(weekStart),
                completionRate: possiblePerWeek ? Math.round((doneCount / possiblePerWeek) * 100) : 0
            };
        });

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
        const end = new Date();
        end.setHours(23, 59, 59, 999);

        const start = new Date();
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - (days - 1));

        const checkins = await CheckIn.find({
            habit: req.params.habitId,
            done: true,
            date: {
                $gte: start,
                $lte: end
            }
        });

        const checkinDays = new Set(checkins.map((checkin) => toDateKey(checkin.date)));
        const history = [];

        for (let index = 0; index < days; index++) {
            const date = new Date(start);
            date.setDate(start.getDate() + index);
            const dateKey = toDateKey(date);

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

        const startOfTheDay=new Date();
        startOfTheDay.setHours(0,0,0,0);
        const endOfTheDay=new Date();
        endOfTheDay.setHours(23,59,59,999);

        const checkIn=await CheckIn.findOne({
            habit:req.params.habitId,
            date:{
                $gte: startOfTheDay,
                $lte: endOfTheDay
            }
        });

        if (checkIn) {
            return res.status(400).json({ message: "Check-in already exists for this habit today" });
        }

        const newCheckIn = new CheckIn({
                habit: req.params.habitId,
                date: new Date(),
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

        const checkins = await CheckIn.find({
            habit: req.params.habitId,
            done: true
        }).sort({ date: -1 });

        // Fast lookup set: "was this habit done on this calendar day?"
        const checkinDays = new Set(checkins.map(c => toDateKey(c.date)));

        let streak = 0;
        let cursor = new Date();
        cursor.setHours(0, 0, 0, 0);
        const todayKey = toDateKey(cursor);

        const yesterday = new Date(cursor);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayKey = toDateKey(yesterday);

        // If today isn't checked off yet, start counting from yesterday
        if (!checkinDays.has(todayKey)) {
            cursor.setDate(cursor.getDate() - 1);
        }

        // Walk backward one day at a time, stop at first gap
        while (checkinDays.has(toDateKey(cursor))) {
            streak++;
            cursor.setDate(cursor.getDate() - 1);
        }

        // Best streak ever: sort the distinct done-days and find the longest run of consecutive days
        const sortedDayKeys = Array.from(checkinDays).sort();
        let bestStreak = 0;
        let runLength = 0;
        let previousDay = null;

        sortedDayKeys.forEach((dayKey) => {
            const current = new Date(`${dayKey}T00:00:00`);
            if (previousDay) {
                const expectedPrevious = new Date(current);
                expectedPrevious.setDate(expectedPrevious.getDate() - 1);
                runLength = toDateKey(expectedPrevious) === toDateKey(previousDay) ? runLength + 1 : 1;
            } else {
                runLength = 1;
            }
            bestStreak = Math.max(bestStreak, runLength);
            previousDay = current;
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
