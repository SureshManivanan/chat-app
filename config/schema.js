const pool = require("../config/database");

// Initialize Database Schema
async function initializeDatabase() {
  let connection;

  try {
    connection = await pool.getConnection();

    // Optional: confirm connection
    console.log("🔗 Connected to database");

    // ---------------- USERS ----------------
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        avatar LONGBLOB,
        bio VARCHAR(500),
        status VARCHAR(20) DEFAULT 'offline',
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ---------------- OTP ----------------
    await connection.query(`
      CREATE TABLE IF NOT EXISTS email_verification (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        otp_code VARCHAR(10) NOT NULL,
        expiry_time DATETIME NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ---------------- PRIVATE MESSAGES ----------------
    await connection.query(`
      CREATE TABLE IF NOT EXISTS private_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        message LONGTEXT,
        message_type VARCHAR(50) DEFAULT 'text',
        file_path VARCHAR(500),
        message_status VARCHAR(20) DEFAULT 'sent',
        read_at DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sender_id) REFERENCES users(id),
        FOREIGN KEY (receiver_id) REFERENCES users(id)
      )
    `);

    // ---------------- BLOCKED USERS ----------------
    await connection.query(`
      CREATE TABLE IF NOT EXISTS blocked_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        blocked_user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_block (user_id, blocked_user_id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (blocked_user_id) REFERENCES users(id)
      )
    `);

    // ---------------- GROUPS ----------------
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`groups\` (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        creator_id INT NOT NULL,
        avatar LONGBLOB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_id) REFERENCES users(id)
      )
    `);

    // ---------------- GROUP MEMBERS ----------------
    await connection.query(`
      CREATE TABLE IF NOT EXISTS group_members (
        id INT AUTO_INCREMENT PRIMARY KEY,
        group_id INT NOT NULL,
        user_id INT NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES \`groups\`(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // ---------------- GROUP MESSAGES ----------------
    await connection.query(`
      CREATE TABLE IF NOT EXISTS group_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        group_id INT NOT NULL,
        sender_id INT NOT NULL,
        message LONGTEXT,
        message_type VARCHAR(50) DEFAULT 'text',
        file_path VARCHAR(500),
        message_status VARCHAR(20) DEFAULT 'sent',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES \`groups\`(id),
        FOREIGN KEY (sender_id) REFERENCES users(id)
      )
    `);

    // ---------------- CLEANUP ----------------
    await connection.query("UPDATE users SET status = 'offline'");
    await connection.query("DELETE FROM email_verification WHERE expiry_time < NOW()");

    console.log("✅ Database connected successfully!");
    console.log("✅ All tables created/verified");
    console.log("✅ Users reset to offline");

  } catch (error) {
    console.error("❌ Database initialization error:", error.message);
  } finally {
    if (connection) connection.release();
  }
}

module.exports = { initializeDatabase };