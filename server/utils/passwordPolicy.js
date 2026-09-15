const COMMON_PASSWORDS = new Set([
    "password", "password1", "password123", "12345678", "123456789",
    "1234567890", "qwerty123", "qwertyuiop", "letmein123", "welcome123",
    "admin1234", "iloveyou1", "monkey123", "dragon123", "sunshine1",
    "princess1", "football1", "baseball1", "trustno1", "master123",
    "abc123456", "1q2w3e4r5t", "changeme1", "starwars1"
]);

const MIN_LENGTH = 12;
const MAX_LENGTH = 128;

// Server-side is the source of truth; the client mirrors these rules for instant feedback.
const validatePassword = (password, { email } = {}) => {
    const errors = [];

    if (typeof password !== "string" || !password) {
        return ["Password is required"];
    }

    if (password.length < MIN_LENGTH) {
        errors.push(`Password must be at least ${MIN_LENGTH} characters long`);
    }

    if (password.length > MAX_LENGTH) {
        errors.push(`Password must be at most ${MAX_LENGTH} characters long`);
    }

    if (!/[a-z]/.test(password)) {
        errors.push("Password must include a lowercase letter");
    }

    if (!/[A-Z]/.test(password)) {
        errors.push("Password must include an uppercase letter");
    }

    if (!/[0-9]/.test(password)) {
        errors.push("Password must include a number");
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
        errors.push("Password must include a symbol");
    }

    if (COMMON_PASSWORDS.has(password.toLowerCase())) {
        errors.push("That password is too common - choose something less predictable");
    }

    if (email && typeof email === "string") {
        const localPart = email.split("@")[0]?.toLowerCase();
        if (localPart && localPart.length > 2 && password.toLowerCase().includes(localPart)) {
            errors.push("Password must not contain your email address");
        }
    }

    return errors;
};

module.exports = { validatePassword, MIN_LENGTH, MAX_LENGTH };
