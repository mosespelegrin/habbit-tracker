const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const ScorecardEntry = require("../models/scorecardEntry.js");
const requireAuth = require("../middleware/auth.js");

router.use(requireAuth);

const isValidObjectId = (id) => typeof id === "string" && /^[a-f\d]{24}$/i.test(id) && mongoose.Types.ObjectId.isValid(id);
const sendServerError = (res) => res.status(500).json({ message: "Internal server error" });
const VALID_RATINGS = new Set(["positive", "negative", "neutral"]);

router.get("/", async (req, res) => {
    try {
        const entries = await ScorecardEntry.find({ owner: req.userId }).sort({ createdAt: 1 });
        res.json(entries);
    } catch (error) {
        console.error("Failed to load scorecard", error);
        sendServerError(res);
    }
});

router.post("/", async (req, res) => {
    try {
        const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
        const rating = req.body?.rating;

        if (!text) {
            return res.status(400).json({ message: "Text is required" });
        }

        if (!VALID_RATINGS.has(rating)) {
            return res.status(400).json({ message: "Rating must be positive, negative, or neutral" });
        }

        const entry = await ScorecardEntry.create({ owner: req.userId, text, rating });
        res.status(201).json(entry);
    } catch (error) {
        console.error("Failed to add scorecard entry", error);
        res.status(400).json({ message: "Invalid scorecard entry" });
    }
});

router.delete("/:id", async (req, res) => {
    if (!isValidObjectId(req.params.id)) {
        return res.status(400).json({ message: "Invalid entry id" });
    }

    try {
        const entry = await ScorecardEntry.findOneAndDelete({ _id: req.params.id, owner: req.userId });
        if (!entry) {
            return res.status(404).json({ message: "Entry not found" });
        }
        res.status(200).json(entry);
    } catch (error) {
        console.error("Failed to delete scorecard entry", error);
        sendServerError(res);
    }
});

module.exports = router;
