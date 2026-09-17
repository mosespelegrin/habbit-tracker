const cron = require("node-cron");
const webpush = require("web-push");
const User = require("../models/user.js");
const Habit = require("../models/habit.js");
const CheckIn = require("../models/chekIn.js");

const currentHHMMInZone = (timeZone) => {
    try {
        return new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
    } catch {
        return new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
    }
};

const dateKeyInZone = (date, timeZone) => {
    try {
        return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
    } catch {
        return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
    }
};

const sendDueReminders = async () => {
    const users = await User.find({ "pushSubscriptions.0": { $exists: true } });
    if (!users.length) return;

    // Wide enough to cover "today" in any timezone relative to the server's clock.
    const lookback = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    for (const user of users) {
        const timeZone = user.timezone || "UTC";
        const nowHHMM = currentHHMMInZone(timeZone);
        const todayKey = dateKeyInZone(new Date(), timeZone);
        const dueHabits = await Habit.find({ owner: user._id, reminderTime: nowHHMM });
        if (!dueHabits.length) continue;

        let subscriptionsChanged = false;

        for (const habit of dueHabits) {
            const recentCheckIns = await CheckIn.find({ habit: habit._id, done: true, date: { $gte: lookback } }).select("date");
            const alreadyDone = recentCheckIns.some((checkIn) => dateKeyInZone(checkIn.date, timeZone) === todayKey);
            if (alreadyDone) continue;

            const payload = JSON.stringify({
                notification: {
                    title: `Time for: ${habit.name}`,
                    body: habit.cue ? `Cue: ${habit.cue}` : "A small step still counts.",
                    icon: "icons/icon-192x192.png",
                    vibrate: [100, 50, 100],
                    data: { habitId: habit._id.toString(), url: "/habits" }
                }
            });

            for (const subscription of user.pushSubscriptions) {
                try {
                    await webpush.sendNotification(subscription, payload);
                } catch (error) {
                    if (error.statusCode === 404 || error.statusCode === 410) {
                        user.pushSubscriptions = user.pushSubscriptions.filter((s) => s.endpoint !== subscription.endpoint);
                        subscriptionsChanged = true;
                    } else {
                        console.error("Push send failed", error.message);
                    }
                }
            }
        }

        if (subscriptionsChanged) {
            await user.save();
        }
    }
};

const startReminderScheduler = () => {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        console.warn("Push reminders disabled: VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not configured");
        return;
    }

    webpush.setVapidDetails(
        process.env.VAPID_SUBJECT || "mailto:admin@example.com",
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );

    cron.schedule("* * * * *", () => {
        sendDueReminders().catch((error) => console.error("Reminder scheduler failed", error));
    });

    console.log("Reminder scheduler started");
};

module.exports = startReminderScheduler;
