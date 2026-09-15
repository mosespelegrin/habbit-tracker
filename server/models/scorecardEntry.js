const mongoose = require("mongoose");

const scorecardEntrySchema = new mongoose.Schema({
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    text: {
        type: String,
        required: true,
        trim: true,
        maxlength: 160
    },
    rating: {
        type: String,
        enum: ["positive", "negative", "neutral"],
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("ScorecardEntry", scorecardEntrySchema);
