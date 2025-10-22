const mongoose = require("mongoose");
const config = require("./config");
const colors = require("colors");

const MAX_RETRIES = 5;
let retries = 0;

const connectWithRetry = async () => {
  try {
    await mongoose.connect(config.database.mongoURI);
    console.log(`✅ MongoDB Connected`.cyan.underline);
    retries = 0; // Reset retry counter on success
  } catch (error) {
    retries += 1;
    console.error(`❌ MongoDB connection failed: ${error.message}`.red.bold);
    if (retries < MAX_RETRIES) {
      console.log(`🔁 Retrying connection (${retries}/${MAX_RETRIES})`.yellow);
      setTimeout(connectWithRetry, 5000);
    } else {
      console.error("🚨 Max retries reached. Exiting...".red.bold);
      process.exit(1);
    }
  }
};

const connectDB = async () => {
  if (!config.database.mongoURI) {
    console.error("MONGO_URI is not set. Exiting...".red.bold);
    process.exit(1);
  }
  connectWithRetry();
};

// Graceful shutdown
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("🛑 MongoDB disconnected due to app termination".magenta);
  process.exit(0);
});

module.exports = connectDB;
