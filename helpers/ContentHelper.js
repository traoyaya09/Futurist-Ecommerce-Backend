const Content = require("../models/ContentModel");

// Add new content
const addContent = async (data) => {
  try {
    const content = new Content(data);
    return await content.save();
  } catch (error) {
    console.error("Error adding content:", error);
    throw new Error("Failed to add content");
  }
};

// Update existing content
const updateContent = async (contentId, data) => {
  try {
    const content = await Content.findByIdAndUpdate(contentId, data, { new: true });
    if (!content) throw new Error("Content not found");
    return content;
  } catch (error) {
    console.error("Error updating content:", error);
    throw new Error("Failed to update content");
  }
};

// Delete content
const deleteContent = async (contentId) => {
  try {
    const deleted = await Content.findByIdAndDelete(contentId);
    if (!deleted) throw new Error("Content not found");
    return { message: "Content deleted successfully" };
  } catch (error) {
    console.error("Error deleting content:", error);
    throw new Error("Failed to delete content");
  }
};

// Fetch content based on filters
const getContentByFilters = async (filters) => {
  try {
    return await Content.find(filters);
  } catch (error) {
    console.error("Error fetching content by filters:", error);
    throw new Error("Failed to fetch content");
  }
};

// Get content by ID
const getContentById = async (contentId) => {
  try {
    return await Content.findById(contentId);
  } catch (error) {
    console.error("Error fetching content by ID:", error);
    throw new Error("Failed to fetch content");
  }
};

module.exports = { addContent, updateContent, deleteContent, getContentByFilters, getContentById };
