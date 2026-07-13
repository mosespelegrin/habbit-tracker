const express=require("express");
const router=express.Router();
const Habit=require("../models/habit.js");
const CheckIn = require("../models/chekIn.js");

router.post("/:habitId/",async(req,res)=>{
    try{
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
        res.status(400).json({ message: error.message });
    }
});


router.get("/streaks/:habitId", async (req, res) => {
    try {
        const checkins = await CheckIn.find({
            habit: req.params.habitId,
            done: true
        }).sort({ date: -1 });

        // Convert a Date into just "day" form, ignoring time-of-day
        const toDateString = (date) => new Date(date).toDateString();

        // Fast lookup set: "was this habit done on this calendar day?"
        const checkinDays = new Set(checkins.map(c => toDateString(c.date)));

        let streak = 0;
        let cursor = new Date();
        cursor.setHours(0, 0, 0, 0);

        // If today isn't checked off yet, start counting from yesterday
        if (!checkinDays.has(toDateString(cursor))) {
            cursor.setDate(cursor.getDate() - 1);
        }

        // Walk backward one day at a time, stop at first gap
        while (checkinDays.has(toDateString(cursor))) {
            streak++;
            cursor.setDate(cursor.getDate() - 1);
        }

        res.json({ streak });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
