const express = require("express");
const authMiddleware = require("../middleware/auth");
const { User, PrivateMessage, Group, GroupMessage } = require("../models/index");

const router = express.Router();

// Admin check middleware - checks if user is admin (email = adminview123@gmail.com)
const adminMiddleware = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || user.email !== "adminview123@gmail.com") {
      return res.status(403).json({ error: "Unauthorized - Admin only" });
    }
    next();
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
};

// Get all users with stats
router.get("/users", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const connection = await require("../config/database").getConnection();
    const [users] = await connection.query(
      `SELECT id, username, email, avatar, bio, status, created_at 
       FROM users 
       ORDER BY created_at DESC`
    );
    connection.release();

    // Enhance with stats
    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const conn = await require("../config/database").getConnection();
        const [msgCount] = await conn.query(
          "SELECT COUNT(*) as count FROM private_messages WHERE sender_id = ?",
          [user.id]
        );
        const [groupCount] = await conn.query(
          "SELECT COUNT(*) as count FROM group_members WHERE user_id = ?",
          [user.id]
        );
        conn.release();

        return {
          ...user,
          messageCount: msgCount[0].count,
          groupCount: groupCount[0].count,
        };
      })
    );

    res.json(usersWithStats);
  } catch (error) {
    console.error("Error fetching admin users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get user activity logs
router.get("/user-activity/:userId", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const connection = await require("../config/database").getConnection();

    // Get user info
    const [user] = await connection.query(
      "SELECT id, username, email, status, created_at FROM users WHERE id = ?",
      [userId]
    );

    // Get recent messages
    const [messages] = await connection.query(
      `SELECT 'message' as type, id, message, created_at, 'private' as category
       FROM private_messages 
       WHERE sender_id = ? 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [userId]
    );

    // Get group messages
    const [groupMessages] = await connection.query(
      `SELECT 'message' as type, id, message, created_at, 'group' as category
       FROM group_messages 
       WHERE sender_id = ? 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [userId]
    );

    connection.release();

    const activity = [...messages, ...groupMessages].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    res.json({
      user: user[0],
      activity: activity.slice(0, 100),
    });
  } catch (error) {
    console.error("Error fetching user activity:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all active sessions
router.get("/active-users", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const connection = await require("../config/database").getConnection();
    const [users] = await connection.query(
      `SELECT id, username, avatar, status, created_at 
       FROM users 
       WHERE status = 'online' 
       ORDER BY created_at DESC`
    );
    connection.release();

    res.json(users);
  } catch (error) {
    console.error("Error fetching active users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get statistics
router.get("/stats", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const connection = await require("../config/database").getConnection();

    const [totalUsers] = await connection.query("SELECT COUNT(*) as count FROM users");
    const [totalGroups] = await connection.query("SELECT COUNT(*) as count FROM `groups`");
    const [totalMessages] = await connection.query(
      "SELECT COUNT(*) as count FROM private_messages"
    );
    const [activeUsers] = await connection.query(
      "SELECT COUNT(*) as count FROM users WHERE status = 'online'"
    );
    const [todayMessages] = await connection.query(
      "SELECT COUNT(*) as count FROM private_messages WHERE DATE(created_at) = CURDATE()"
    );

    connection.release();

    res.json({
      totalUsers: totalUsers[0].count,
      totalGroups: totalGroups[0].count,
      totalMessages: totalMessages[0].count,
      activeUsers: activeUsers[0].count,
      todayMessages: todayMessages[0].count,
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Delete user (admin only)
router.delete("/user/:userId", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    if (userId === 1) {
      return res.status(400).json({ error: "Cannot delete admin user" });
    }

    const connection = await require("../config/database").getConnection();
    await connection.query("DELETE FROM users WHERE id = ?", [userId]);
    connection.release();

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
