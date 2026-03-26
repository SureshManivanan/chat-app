const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.MYSQLHOST,
  port: process.env.MYSQLPORT,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ✅ Test connection immediately (important)
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log(
      `✅ MySQL connected successfully (host: ${process.env.MYSQLHOST}, db: ${process.env.MYSQLDATABASE})`
    );
    conn.release();
  } catch (err) {
    console.error(
      `❌ MySQL connection failed (host: ${process.env.MYSQLHOST}):`,
      err.message
    );
  }
})();

module.exports = pool;