const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("../config/config");

// ✅ Hash Password
const hashPassword = async (password) => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
};

// ✅ Compare Password
const comparePassword = async (enteredPassword, storedHashedPassword) => {
    return bcrypt.compare(enteredPassword, storedHashedPassword);
};

// ✅ Generate JWT Tokens
const generateToken = (user) => {
    console.log("🔹 JWT Secret (inside AuthHelper):", config.jwt.secret); // Debugging

    if (!config.jwt.secret) {
        throw new Error("❌ JWT Secret is missing. Check your .env and config.js");
    }

    const accessToken = jwt.sign({ userId: user._id }, config.jwt.secret, {
        expiresIn: config.jwtExpiresIn || "30d",
    });

    const refreshToken = jwt.sign({ userId: user._id }, config.jwt.refreshSecret, {
        expiresIn: "90d",
    });

    return { accessToken, refreshToken };
};

// ✅ Exports
module.exports = {
    hashPassword,
    comparePassword,
    generateToken,
};
