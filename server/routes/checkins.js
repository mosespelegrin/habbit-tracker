const express=require("express");
const router=express.Router();
const mongoose=require("mongoose");
const Habit=require("../models/habit.js");
const CheckIn = require("../models/chekIn.js");

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

router.get("/history/:habitId", async (req, res) => {
    if(!isValidObjectId(req.params.habitId)){
        return res.status(400).json({message:"Invalid habit id"});
    }

    try {
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
        const habitExists=await Habit.exists({_id:req.params.habitId});
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
