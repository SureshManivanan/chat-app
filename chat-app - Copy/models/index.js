const pool = require("../config/database");

// User Model
const User = {
  async createWithEmail(username, email) {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query(
        "INSERT INTO users (username, email, password, is_verified) VALUES (?, ?, NULL, ?)",
        [username, email, true]
      );
      return result.insertId;
    } finally {
      connection.release();
    }
  },

  async create(username, email, hashedPassword) {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query(
        "INSERT INTO users (username, email, password, is_verified) VALUES (?, ?, ?, ?)",
        [username, email, hashedPassword, false]
      );
      return result.insertId;
    } finally {
      connection.release();
    }
  },

  async findByEmail(email) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query("SELECT * FROM users WHERE email = ?", [email]);
      return rows[0];
    } finally {
      connection.release();
    }
  },

  async findById(id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        "SELECT id, username, email, avatar, bio, status FROM users WHERE id = ?",
        [id]
      );
      return rows[0];
    } finally {
      connection.release();
    }
  },

  async updateStatus(userId, status) {
    const connection = await pool.getConnection();
    try {
      await connection.query("UPDATE users SET status = ? WHERE id = ?", [status, userId]);
    } finally {
      connection.release();
    }
  },

  async updateProfile(userId, avatar, bio) {
    const connection = await pool.getConnection();
    try {
      await connection.query(
        "UPDATE users SET avatar = ?, bio = ? WHERE id = ?",
        [avatar, bio, userId]
      );
    } finally {
      connection.release();
    }
  },

  async getAllUsers() {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        "SELECT id, username, avatar, status FROM users"
      );
      return rows;
    } finally {
      connection.release();
    }
  },

  async getChattedUsers(userId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        `SELECT DISTINCT u.id, u.username, u.avatar, u.status
         FROM users u
         INNER JOIN private_messages pm ON (pm.sender_id = u.id OR pm.receiver_id = u.id)
         WHERE (pm.sender_id = ? OR pm.receiver_id = ?) AND u.id != ?
         ORDER BY u.username ASC`,
        [userId, userId, userId]
      );
      return rows;
    } finally {
      connection.release();
    }
  },

  async getOnlineUsers() {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        "SELECT id FROM users WHERE status = 'online'"
      );
      return rows.map((row) => row.id);
    } finally {
      connection.release();
    }
  },
};

// Private Message Model
const PrivateMessage = {
  async create(senderId, receiverId, message, type = "text", filePath = null) {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query(
        "INSERT INTO private_messages (sender_id, receiver_id, message, message_type, file_path, message_status) VALUES (?, ?, ?, ?, ?, 'sent')",
        [senderId, receiverId, message, type, filePath]
      );
      return result.insertId;
    } finally {
      connection.release();
    }
  },

  async getHistory(user1Id, user2Id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        `SELECT pm.id, pm.sender_id, pm.message, pm.message_type, pm.file_path,
                pm.message_status, pm.read_at, pm.created_at, u.username, u.avatar
         FROM private_messages pm
         JOIN users u ON u.id = pm.sender_id
         WHERE (pm.sender_id = ? AND pm.receiver_id = ?)
            OR (pm.sender_id = ? AND pm.receiver_id = ?)
         ORDER BY pm.created_at ASC`,
        [user1Id, user2Id, user2Id, user1Id]
      );
      return rows;
    } finally {
      connection.release();
    }
  },

  async updateMessageStatus(messageId, status) {
    const connection = await pool.getConnection();
    try {
      await connection.query(
        "UPDATE private_messages SET message_status = ? WHERE id = ?",
        [status, messageId]
      );
    } finally {
      connection.release();
    }
  },

  async findById(messageId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        "SELECT * FROM private_messages WHERE id = ?",
        [messageId]
      );
      return rows[0];
    } finally {
      connection.release();
    }
  },

  async markAsRead(messageId) {
    const connection = await pool.getConnection();
    try {
      await connection.query(
        "UPDATE private_messages SET message_status = 'read', read_at = NOW() WHERE id = ?",
        [messageId]
      );
    } finally {
      connection.release();
    }
  },

  async markAsDelivered(messageId) {
    const connection = await pool.getConnection();
    try {
      await connection.query(
        "UPDATE private_messages SET message_status = 'delivered' WHERE id = ?",
        [messageId]
      );
    } finally {
      connection.release();
    }
  },

  async getPendingMessages(userId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        "SELECT * FROM private_messages WHERE receiver_id = ? AND message_status = 'sent'",
        [userId]
      );
      return rows;
    } finally {
      connection.release();
    }
  },

  async deleteMessage(messageId) {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query(
        "DELETE FROM private_messages WHERE id = ?",
        [messageId]
      );
      return result.affectedRows > 0;
    } finally {
      connection.release();
    }
  },
};

// Group Model
const Group = {
  async create(name, creatorId, description = "") {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query(
        "INSERT INTO `groups` (name, description, creator_id) VALUES (?, ?, ?)",
        [name, description, creatorId]
      );
      return result.insertId;
    } finally {
      connection.release();
    }
  },

  async addMember(groupId, userId) {
    const connection = await pool.getConnection();
    try {
      await connection.query(
        "INSERT INTO group_members (group_id, user_id) VALUES (?, ?)",
        [groupId, userId]
      );
    } finally {
      connection.release();
    }
  },

  async getMembers(groupId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        `SELECT u.id, u.username, u.avatar, u.status
         FROM group_members gm
         JOIN users u ON u.id = gm.user_id
         WHERE gm.group_id = ?`,
        [groupId]
      );
      return rows;
    } finally {
      connection.release();
    }
  },

  async getUserGroups(userId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        `SELECT g.id, g.name, g.avatar, g.description
         FROM group_members gm
         JOIN \`groups\` g ON g.id = gm.group_id
         WHERE gm.user_id = ?`,
        [userId]
      );
      return rows;
    } finally {
      connection.release();
    }
  },
};

// Group Message Model
const GroupMessage = {
  async create(groupId, senderId, message, type = "text", filePath = null) {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.query(
        "INSERT INTO group_messages (group_id, sender_id, message, message_type, file_path) VALUES (?, ?, ?, ?, ?)",
        [groupId, senderId, message, type, filePath]
      );
      return result.insertId;
    } finally {
      connection.release();
    }
  },

  async getHistory(groupId, limit = 50) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        `SELECT gm.id, gm.sender_id, gm.message, gm.message_type, gm.file_path,
                gm.created_at, u.username, u.avatar
         FROM group_messages gm
         JOIN users u ON u.id = gm.sender_id
         WHERE gm.group_id = ?
         ORDER BY gm.created_at DESC
         LIMIT ?`,
        [groupId, limit]
      );
      return rows.reverse();
    } finally {
      connection.release();
    }
  },
};

// OTP Model
const OTP = {
  async create(email, otpCode, expiryTime) {
    const connection = await pool.getConnection();
    try {
      await connection.query(
        "DELETE FROM email_verification WHERE email = ?",
        [email]
      );
      const [result] = await connection.query(
        "INSERT INTO email_verification (email, otp_code, expiry_time) VALUES (?, ?, ?)",
        [email, otpCode, expiryTime]
      );
      return result.insertId;
    } finally {
      connection.release();
    }
  },

  async findByEmailAndOTP(email, otpCode) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        "SELECT * FROM email_verification WHERE email = ? AND otp_code = ? AND expiry_time > NOW()",
        [email, otpCode]
      );
      return rows[0];
    } finally {
      connection.release();
    }
  },

  async deleteOTP(email) {
    const connection = await pool.getConnection();
    try {
      await connection.query(
        "DELETE FROM email_verification WHERE email = ?",
        [email]
      );
    } finally {
      connection.release();
    }
  },

  async getLatestOTP(email) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        "SELECT * FROM email_verification WHERE email = ? ORDER BY created_at DESC LIMIT 1",
        [email]
      );
      return rows[0];
    } finally {
      connection.release();
    }
  },

  async markUserVerified(email) {
    const connection = await pool.getConnection();
    try {
      await connection.query(
        "UPDATE users SET is_verified = TRUE WHERE email = ?",
        [email]
      );
    } finally {
      connection.release();
    }
  },
};

// Blocked Users Model
const BlockedUser = {
  async blockUser(userId, blockedUserId) {
    const connection = await pool.getConnection();
    try {
      await connection.query(
        "INSERT IGNORE INTO blocked_users (user_id, blocked_user_id) VALUES (?, ?)",
        [userId, blockedUserId]
      );
    } finally {
      connection.release();
    }
  },

  async unblockUser(userId, blockedUserId) {
    const connection = await pool.getConnection();
    try {
      await connection.query(
        "DELETE FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?",
        [userId, blockedUserId]
      );
    } finally {
      connection.release();
    }
  },

  async getBlockedUsers(userId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        "SELECT blocked_user_id FROM blocked_users WHERE user_id = ?",
        [userId]
      );
      return rows.map((row) => row.blocked_user_id);
    } finally {
      connection.release();
    }
  },

  async isUserBlocked(userId, blockedUserId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        "SELECT id FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?",
        [userId, blockedUserId]
      );
      return rows.length > 0;
    } finally {
      connection.release();
    }
  },
};

module.exports = { User, PrivateMessage, Group, GroupMessage, OTP, BlockedUser };
