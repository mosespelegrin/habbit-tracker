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

const sendDueReminders = async () => {
    const users = await User.find({ "pushSubscriptions.0": { $exists: true } });
    if (!users.length) return;

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    for (const user of users) {
        const nowHHMM = currentHHMMInZone(user.timezone || "UTC");
        const dueHabits = await Habit.find({ owner: user._id, reminderTime: nowHHMM });
        if (!dueHabits.length) continue;

        let subscriptionsChanged = false;

        for (const habit of dueHabits) {
            const alreadyDone = await CheckIn.exists({ habit: habit._id, done: true, date: { $gte: startOfDay } });
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
