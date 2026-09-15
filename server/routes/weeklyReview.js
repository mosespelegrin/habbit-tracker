const express = require("express");
const router = express.Router();
const WeeklyReview = require("../models/weeklyReview.js");
const requireAuth = require("../middleware/auth.js");

router.use(requireAuth);

const sendServerError = (res) => res.status(500).json({ message: "Internal server error" });
const WEEK_START_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

router.get("/", async (req, res) => {
    try {
        const reviews = await WeeklyReview.find({ owner: req.userId }).sort({ weekStart: -1 });
        res.json(reviews);
    } catch (error) {
        console.error("Failed to load weekly reviews", error);
        sendServerError(res);
    }
});

router.get("/:weekStart", async (req, res) => {
    if (!WEEK_START_PATTERN.test(req.params.weekStart)) {
        return res.status(400).json({ message: "weekStart must be in YYYY-MM-DD format" });
    }

    try {
        const review = await WeeklyReview.findOne({ owner: req.userId, weekStart: req.params.weekStart });
        res.json(review || { owner: req.userId, weekStart: req.params.weekStart, wins: "", misses: "", tweak: "" });
    } catch (error) {
        console.error("Failed to load weekly review", error);
        sendServerError(res);
    }
});

router.put("/:weekStart", async (req, res) => {
    if (!WEEK_START_PATTERN.test(req.params.weekStart)) {
        return res.status(400).json({ message: "weekStart must be in YYYY-MM-DD format" });
    }

    try {
        const source = req.body || {};
        const update = { updatedAt: new Date() };

        ["wins", "misses", "tweak"].forEach((field) => {
            if (typeof source[field] === "string") {
                update[field] = source[field].trim().slice(0, 1000);
            }
        });

        const review = await WeeklyReview.findOneAndUpdate(
            { owner: req.userId, weekStart: req.params.weekStart },
            { $set: update, $setOnInsert: { owner: req.userId, weekStart: req.params.weekStart } },
            { new: true, upsert: true, runValidators: true }
        );

        res.status(200).json(review);
    } catch (error) {
        console.error("Failed to save weekly review", error);
        res.status(400).json({ message: "Invalid weekly review data" });
    }
});

module.exports = router;
