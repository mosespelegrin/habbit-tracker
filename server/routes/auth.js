const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user.js");
const requireAuth = require("../middleware/auth.js");
const { validatePassword } = require("../utils/passwordPolicy.js");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 11;
const TOKEN_TTL = "14d";

const sendServerError = (res) => {
    res.status(500).json({ message: "Internal server error" });
};

const issueToken = (user) =>
    jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });

// Brute-force guard scoped to login attempts, independent of the general API rate limiter.
const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 10;

const isLoginRateLimited = (key) => {
    const now = Date.now();
    const entry = loginAttempts.get(key) || { count: 0, resetAt: now + LOGIN_WINDOW_MS };

    if (now > entry.resetAt) {
        entry.count = 0;
        entry.resetAt = now + LOGIN_WINDOW_MS;
    }

    entry.count++;
    loginAttempts.set(key, entry);

    return entry.count > MAX_LOGIN_ATTEMPTS;
};

router.post("/register", async (req, res) => {
    try {
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        const password = req.body?.password;

        if (!EMAIL_PATTERN.test(email) || email.length > 254) {
            return res.status(400).json({ message: "A valid email is required" });
        }

        const passwordErrors = validatePassword(password, { email });
        if (passwordErrors.length) {
            return res.status(400).json({ message: passwordErrors[0], errors: passwordErrors });
        }

        const existing = await User.exists({ email });
        if (existing) {
            return res.status(409).json({ message: "An account with that email already exists" });
        }

        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
        const user = await User.create({ email, passwordHash });

        res.status(201).json({ token: issueToken(user), email: user.email });
    } catch (error) {
        console.error("Failed to register user", error);
        sendServerError(res);
    }
});

router.post("/login", async (req, res) => {
    try {
        const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
        const password = req.body?.password;
        const rateLimitKey = `${req.ip || "unknown"}:${email}`;

        if (isLoginRateLimited(rateLimitKey)) {
            return res.status(429).json({ message: "Too many login attempts. Try again later." });
        }

        if (!email || typeof password !== "string") {
            return res.status(400).json({ message: "Email and password are required" });
        }

        const user = await User.findOne({ email });
        const passwordHash = user ? user.passwordHash : "$2b$11$invalidsaltinvalidsaltinvalidsaltinvalidsaltinvalid1";
        const isMatch = await bcrypt.compare(password, passwordHash);

        if (!user || !isMatch) {
            return res.status(401).json({ message: "Invalid email or password" });
        }

        res.json({ token: issueToken(user), email: user.email });
    } catch (error) {
        console.error("Failed to log in user", error);
        sendServerError(res);
    }
});

router.get("/me", requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select("email createdAt");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.json({ email: user.email, createdAt: user.createdAt });
    } catch (error) {
        console.error("Failed to load user", error);
        sendServerError(res);
    }
});

router.get("/password-policy", (req, res) => {
    res.json({
        minLength: 12,
        maxLength: 128,
        rules: [
            "At least 12 characters",
            "At least one lowercase letter",
            "At least one uppercase letter",
            "At least one number",
            "At least one symbol",
            "Not a commonly used password",
            "Does not contain your email address"
        ]
    });
});

module.exports = router;
