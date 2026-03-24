const express = require("express");
const authMiddleware = require("../middleware/auth");
const { BlockedUser } = require("../models/index");

const router = express.Router();

// Block a user
router.post("/block", authMiddleware, async (req, res) => {
  try {
    const { blockedUserId } = req.body;
    const userId = req.userId;

    if (!blockedUserId) {
      return res.status(400).json({ error: "Missing required field: blockedUserId" });
    }

    if (userId === blockedUserId) {
      return res.status(400).json({ error: "Cannot block yourself" });
    }

    await BlockedUser.blockUser(userId, blockedUserId);
    res.json({ message: "User blocked successfully" });
  } catch (error) {
    console.error("Block user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Unblock a user
router.post("/unblock", authMiddleware, async (req, res) => {
  try {
    const { blockedUserId } = req.body;
    const userId = req.userId;

    if (!blockedUserId) {
      return res.status(400).json({ error: "Missing required field: blockedUserId" });
    }

    await BlockedUser.unblockUser(userId, blockedUserId);
    res.json({ message: "User unblocked successfully" });
  } catch (error) {
    console.error("Unblock user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get list of blocked users
router.get("/list", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const blockedUserIds = await BlockedUser.getBlockedUsers(userId);
    res.json({ blockedUsers: blockedUserIds });
  } catch (error) {
    console.error("Get blocked users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Check if user is blocked
router.post("/check", authMiddleware, async (req, res) => {
  try {
    const { otherId } = req.body;
    const userId = req.userId;

    if (!otherId) {
      return res.status(400).json({ error: "Missing required field: otherId" });
    }

    const isBlocked = await BlockedUser.isUserBlocked(userId, otherId);
    const isBlockedBy = await BlockedUser.isUserBlocked(otherId, userId);

    res.json({ isBlocked, isBlockedBy });
  } catch (error) {
    console.error("Check blocked status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
