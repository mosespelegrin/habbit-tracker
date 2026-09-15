const express = require("express");
const router = express.Router();
const User = require("../models/user.js");
const requireAuth = require("../middleware/auth.js");

const sendServerError = (res) => res.status(500).json({ message: "Internal server error" });

// Supported IANA zone names only - matchable against Intl without throwing.
const isValidTimeZone = (value) => {
    if (typeof value !== "string" || value.length > 64) return false;
    try {
        Intl.DateTimeFormat(undefined, { timeZone: value });
        return true;
    } catch {
        return false;
    }
};

router.get("/vapid-public-key", (req, res) => {
    if (!process.env.VAPID_PUBLIC_KEY) {
        return res.status(503).json({ message: "Push notifications are not configured on this server" });
    }
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

router.post("/subscribe", requireAuth, async (req, res) => {
    try {
        const subscription = req.body?.subscription;
        const timezone = req.body?.timezone;

        if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
            return res.status(400).json({ message: "A valid push subscription is required" });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        user.pushSubscriptions = user.pushSubscriptions.filter((existing) => existing.endpoint !== subscription.endpoint);
        user.pushSubscriptions.push({
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth }
        });

        if (isValidTimeZone(timezone)) {
            user.timezone = timezone;
        }

        await user.save();
        res.status(201).json({ message: "Subscribed" });
    } catch (error) {
        console.error("Failed to save push subscription", error);
        sendServerError(res);
    }
});

router.post("/unsubscribe", requireAuth, async (req, res) => {
    try {
        const endpoint = req.body?.endpoint;
        if (typeof endpoint !== "string" || !endpoint) {
            return res.status(400).json({ message: "endpoint is required" });
        }

        await User.updateOne({ _id: req.userId }, { $pull: { pushSubscriptions: { endpoint } } });
        res.status(200).json({ message: "Unsubscribed" });
    } catch (error) {
        console.error("Failed to remove push subscription", error);
        sendServerError(res);
    }
});

module.exports = router;
