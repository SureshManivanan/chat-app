const express = require("express");
const multer = require("multer");
const path = require("path");
const authMiddleware = require("../middleware/auth");
const { User, PrivateMessage, Group, GroupMessage } = require("../models/index");

const router = express.Router();

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../uploads"));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// Get current user
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all users
router.get("/all", authMiddleware, async (req, res) => {
  try {
    const users = await User.getAllUsers();
    console.log("📋 Users fetched from DB:", users.length, "users");
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get chatted users (users with whom current user has had conversations)
router.get("/chatted", authMiddleware, async (req, res) => {
  try {
    const users = await User.getChattedUsers(req.userId);
    console.log("💬 Chatted users fetched from DB:", users.length, "users");
    res.json(users);
  } catch (error) {
    console.error("Error fetching chatted users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update profile
router.put("/profile", authMiddleware, upload.single("avatar"), async (req, res) => {
  try {
    const { bio } = req.body;
    const avatar = req.file ? `/uploads/${req.file.filename}` : null;

    await User.updateProfile(req.userId, avatar, bio);
    const user = await User.findById(req.userId);

    res.json({ message: "Profile updated", user });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get private message history
router.get("/private-messages/:otherUserId", authMiddleware, async (req, res) => {
  try {
    const messages = await PrivateMessage.getHistory(req.userId, parseInt(req.params.otherUserId));
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete a private message (sender or receiver)
router.delete("/private-messages/:messageId", authMiddleware, async (req, res) => {
  try {
    const messageId = parseInt(req.params.messageId);
    const message = await PrivateMessage.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (message.sender_id !== req.userId && message.receiver_id !== req.userId) {
      return res.status(403).json({ error: "Not allowed to delete this message" });
    }

    await PrivateMessage.deleteMessage(messageId);
    res.json({ message: "Message deleted" });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get user groups
router.get("/groups", authMiddleware, async (req, res) => {
  try {
    const groups = await Group.getUserGroups(req.userId);
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create group
router.post("/groups", authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;
    const groupId = await Group.create(name, req.userId, description);
    await Group.addMember(groupId, req.userId);

    res.status(201).json({ message: "Group created", groupId });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get group members
router.get("/groups/:groupId/members", authMiddleware, async (req, res) => {
  try {
    const members = await Group.getMembers(parseInt(req.params.groupId));
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Add member to group
router.post("/groups/:groupId/members", authMiddleware, async (req, res) => {
  try {
    const { userId } = req.body;
    await Group.addMember(parseInt(req.params.groupId), userId);

    res.json({ message: "Member added to group" });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get group message history
router.get("/groups/:groupId/messages", authMiddleware, async (req, res) => {
  try {
    const messages = await GroupMessage.getHistory(parseInt(req.params.groupId));
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// Upload file
router.post("/upload", authMiddleware, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    res.json({ filePath: `/uploads/${req.file.filename}` });
  } catch (error) {
    res.status(500).json({ error: "Upload failed" });
  }
});

module.exports = router;
