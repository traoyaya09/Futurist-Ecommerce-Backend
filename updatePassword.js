const bcrypt = require("bcrypt");
const mongoose = require("mongoose");

// 🟢 Replace with your actual MongoDB connection string (use .env for security)
const MONGO_URI = "mongodb+srv://traoyaya09:vcqgF9ub9r57oq0m@cluster0.lbqbl2z.mongodb.net/futurist_e-commerce";

// ✅ Connect to MongoDB
mongoose.connect(MONGO_URI);



// ✅ Define User Model
const User = mongoose.model("User", new mongoose.Schema({ email: String, password: String }));

// ✅ Hash and Update User Password
const hashAndUpdate = async () => {
  try {
    const user = await User.findOne({ email: "traoyaya09@gmail.com" });

    if (!user) {
      console.log("❌ User not found");
      return;
    }

    user.password = await bcrypt.hash("96787872Yt", 10); // ✅ Hash password
    await user.save();

    console.log("✅ Password updated successfully");
  } catch (error) {
    console.error("❌ Error updating password:", error.message);
  } finally {
    mongoose.connection.close(); // ✅ Close the DB connection after execution
  }
};

// ✅ Run the update function
hashAndUpdate();
