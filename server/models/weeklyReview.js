const mongoose = require("mongoose");

const weeklyReviewSchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    weekStart: {
        type: String,
        required: true,
        validate: {
            validator: (value) => /^\d{4}-\d{2}-\d{2}$/.test(value),
            message: "weekStart must be in YYYY-MM-DD format"
        }
    },
    wins: {
        type: String,
        default: "",
        trim: true,
        maxlength: 1000
    },
    misses: {
        type: String,
        default: "",
        trim: true,
        maxlength: 1000
    },
    tweak: {
        type: String,
        default: "",
        trim: true,
        maxlength: 1000
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

weeklyReviewSchema.index({ owner: 1, weekStart: 1 }, { unique: true });

module.exports = mongoose.model("WeeklyReview", weeklyReviewSchema);
