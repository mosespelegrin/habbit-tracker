const jwt = require("jsonwebtoken");

const requireAuth = (req, res, next) => {
    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

    if (!token) {
        return res.status(401).json({ message: "Authentication required" });
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = payload.sub;
        next();
    } catch {
        res.status(401).json({ message: "Invalid or expired session" });
    }
};

module.exports = requireAuth;
