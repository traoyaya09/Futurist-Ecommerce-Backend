const { 
  addContent, 
  updateContent, 
  deleteContent, 
  getContentByFilters, 
  getContentById 
} = require("../helpers/ContentHelper");
const { getSocketInstance } = require('../socket');

const contentController = {
  // Manage content (add, update, delete)
  manageContent: async (req, res) => {
    try {
      const { action, contentId, ...contentData } = req.body;

      if (!action) {
        return res.status(400).json({ message: "Action is required" });
      }

      let content;
      switch (action) {
        case "add":
          content = await addContent(contentData);
          break;
        case "update":
          if (!contentId) {
            return res.status(400).json({ message: "Content ID is required for updating" });
          }
          content = await updateContent(contentId, contentData);
          break;
        case "delete":
          if (!contentId) {
            return res.status(400).json({ message: "Content ID is required for deletion" });
          }
          content = await deleteContent(contentId);
          break;
        default:
          return res.status(400).json({ message: "Invalid action" });
      }

      // Emit corresponding socket event based on action
      const io = getSocketInstance();
      if (action === "add") {
        io.emit('content:added', content);
      } else if (action === "update") {
        io.emit('content:updated', content);
      } else if (action === "delete") {
        io.emit('content:deleted', contentId);
      }

      res.status(200).json({ success: true, message: `Content ${action}d successfully`, content });
    } catch (error) {
      console.error("Content management error:", error);
      res.status(500).json({ message: "Error managing content" });
    }
  },

  // Get content based on filters
  getContentByFilters: async (req, res) => {
    try {
      const filters = req.query;
      const content = await getContentByFilters(filters);
      res.status(200).json(content);
    } catch (error) {
      console.error("Error fetching content:", error);
      res.status(500).json({ message: "Error fetching content" });
    }
  },

  // Get content by ID
  getContentById: async (req, res) => {
    try {
      const { contentId } = req.params;
      const content = await getContentById(contentId);
      if (!content) return res.status(404).json({ message: "Content not found" });
      res.status(200).json(content);
    } catch (error) {
      console.error("Error fetching content by ID:", error);
      res.status(500).json({ message: "Error fetching content" });
    }
  },
};

module.exports = contentController;
