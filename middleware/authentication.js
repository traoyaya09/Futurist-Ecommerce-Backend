const jwt = require("jsonwebtoken");
const config = require("../config/config");
const User = require("../models/UserModel");


const authenticate = async (req, res, next) => {
  try {
      let token;
      
      if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
          token = req.headers.authorization.split(" ")[1];
      }
      console.log("Token extracted in middleware:", token);


      if (!token) {
          return res.status(401).json({ message: "Authorization token is required" });
      }

      const decoded = jwt.verify(token, config.jwt.secret);

      const user = await User.findById(decoded.userId).select("-password");
      if (!user) {
          return res.status(404).json({ message: "User not found" });
      }

      req.user = user;
      next();
  } catch (error) {
      console.error("❌ Authentication error:", error.message);
      return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Middleware to check if the user has admin privileges
const isAdmin = (req, res, next) => {
  if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
  }

  if (!req.user.isAdmin) {
      return res.status(403).json({ message: "Access denied. Admin privileges required." });
  }

  next();
};

// Middleware to ensure user is authenticated (Alias for clarity)
const requireSignIn = authenticate;

// Combined middleware for admin protection
const protect = [authenticate, isAdmin];

module.exports = { authenticate, requireSignIn, isAdmin, protect };
