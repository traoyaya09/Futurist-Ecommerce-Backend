const mongoose = require("mongoose");

const contentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    category: { type: String, required: true }, // e.g., "Blog", "News"
    tags: { type: [String], default: [] },
    author: { type: String, default: "Admin" },
    status: { type: String, enum: ["draft", "published", "archived"], default: "draft" },
  },
  { timestamps: true } // Auto-creates createdAt and updatedAt
);

const Content = mongoose.model("Content", contentSchema);

module.exports = Content;
