const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        maxlength: 254
    },
    passwordHash: {
        type: String,
        required: true
    },
    timezone: {
        type: String,
        default: "UTC",
        maxlength: 64
    },
    pushSubscriptions: {
        type: [
            {
                endpoint: { type: String, required: true },
                keys: {
                    p256dh: { type: String, required: true },
                    auth: { type: String, required: true }
                }
            }
        ],
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("User", userSchema);
