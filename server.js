const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "uploads"));
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Create uploads directory if not exists
if (!fs.existsSync(path.join(__dirname, "uploads"))) {
  fs.mkdirSync(path.join(__dirname, "uploads"));
}

// Initialize Database
const { initializeDatabase } = require("./config/schema");
initializeDatabase().catch((err) => {
  console.warn("⚠️  Database initialization warning:", err.message);
});

// Routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const adminRoutes = require("./routes/admin");
const blockedRoutes = require("./routes/blocked");

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/blocked", blockedRoutes);
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  res.json({ filePath: `/uploads/${req.file.filename}` });
});

// Socket.io connections
const userSocketMap = new Map(); // userId -> Set(socketId)

io.on("connection", (socket) => {
  console.log("✅ User connected:", socket.id);

  // ─────────────────────────────────────────────
  // User Login
  // ─────────────────────────────────────────────
  socket.on("user-login", async ({ userId, username }) => {
    socket.userId = userId;
    socket.username = username;

    if (!userSocketMap.has(userId)) {
      userSocketMap.set(userId, new Set());
    }
    userSocketMap.get(userId).add(socket.id);

    // Update user status to online in database
    const { User, PrivateMessage } = require("./models/index");
    await User.updateStatus(userId, "online").catch((err) =>
      console.error("Error updating user status:", err)
    );

    // ✅ FIX: Broadcast to ALL other connected clients that this user is now online
    socket.broadcast.emit("user-online", { userId, username, status: "online" });

    // ✅ FIX: Send the newly logged-in user the full list of currently online users
    // so they can immediately see green dots for everyone already online
    const onlineUserIds = [];
    for (const [, s] of io.sockets.sockets) {
      if (s.userId && s.userId !== userId) {
        onlineUserIds.push(s.userId);
      }
    }
    socket.emit("online-users-list", { onlineUserIds });

    console.log(
      `📍 User ${username} (${userId}) is online. Sent online list: [${onlineUserIds.join(", ")}]`
    );

    // Send pending messages that were sent while user was offline
    try {
      const pendingMessages = await PrivateMessage.getPendingMessages(userId);
      for (const msg of pendingMessages) {
        await PrivateMessage.markAsDelivered(msg.id);

        io.to(socket.id).emit("receive-private-message", {
          messageId: msg.id,
          senderId: msg.sender_id,
          message: msg.message,
          messageType: msg.message_type,
          filePath: msg.file_path,
          messageStatus: "delivered",
          timestamp: msg.created_at,
        });

        const senderSocketIds = userSocketMap.get(msg.sender_id);
        if (senderSocketIds) {
          senderSocketIds.forEach((socketId) => {
            io.to(socketId).emit("message-status-update", {
              messageId: msg.id,
              status: "delivered",
            });
          });
        }
      }
    } catch (err) {
      console.error("Error sending pending messages:", err);
    }
  });

  // ─────────────────────────────────────────────
  // ✅ FIX: Get Online Users (called after loadChatData refreshes the user list)
  // Returns the current online users list to the requesting socket
  // ─────────────────────────────────────────────
  socket.on("get-online-users", () => {
    const onlineUserIds = [];
    for (const [, s] of io.sockets.sockets) {
      if (s.userId && s.userId !== socket.userId) {
        onlineUserIds.push(s.userId);
      }
    }
    socket.emit("online-users-list", { onlineUserIds });
  });

  // ─────────────────────────────────────────────
  // Private Message
  // ─────────────────────────────────────────────
  socket.on("private-message", async (data) => {
    const { senderId, receiverId, message, messageType, filePath } = data;

    try {
      const { PrivateMessage } = require("./models/index");
      const messageId = await PrivateMessage.create(
        senderId,
        receiverId,
        message,
        messageType,
        filePath
      );

      // Confirm to sender
      const senderSocketIds = userSocketMap.get(senderId);
      if (senderSocketIds) {
        senderSocketIds.forEach((socketId) => {
          io.to(socketId).emit("message-sent", { messageId, status: "sent" });
        });
      }

      // Deliver to receiver
      const receiverSocketIds = userSocketMap.get(receiverId);
      if (receiverSocketIds) {
        await PrivateMessage.markAsDelivered(messageId);

        receiverSocketIds.forEach((socketId) => {
          io.to(socketId).emit("receive-private-message", {
            messageId,
            senderId,
            message,
            messageType,
            filePath,
            messageStatus: "delivered",
            timestamp: new Date(),
          });
        });

        if (senderSocketIds) {
          senderSocketIds.forEach((socketId) => {
            io.to(socketId).emit("message-status-update", {
              messageId,
              status: "delivered",
            });
          });
        }
      }
    } catch (err) {
      console.error("Error saving private message:", err);
    }
  });

  // ─────────────────────────────────────────────
  // Message Delivered
  // ─────────────────────────────────────────────
  socket.on("message-delivered", ({ messageId, receiverId }) => {
    const { PrivateMessage } = require("./models/index");

    if (messageId) {
      PrivateMessage.markAsDelivered(messageId).catch((err) =>
        console.error("Error updating message status:", err)
      );
    }

    const senderSocketIds = userSocketMap.get(socket.userId);
    if (senderSocketIds) {
      senderSocketIds.forEach((socketId) => {
        io.to(socketId).emit("message-status-update", { messageId, status: "delivered" });
      });
    }
  });

  // ─────────────────────────────────────────────
  // Message Read
  // ─────────────────────────────────────────────
  socket.on("message-read", ({ messageId, senderId }) => {
    const { PrivateMessage } = require("./models/index");

    if (messageId) {
      PrivateMessage.markAsRead(messageId).catch((err) =>
        console.error("Error marking message as read:", err)
      );
    }

    const senderSocketIds = userSocketMap.get(senderId);
    if (senderSocketIds) {
      senderSocketIds.forEach((socketId) => {
        io.to(socketId).emit("message-status-update", { messageId, status: "read" });
      });
    }
  });

  // ─────────────────────────────────────────────
  // Message Deleted
  // ─────────────────────────────────────────────
  socket.on("delete-message", async ({ messageId, chatUserId }) => {
    const { PrivateMessage } = require("./models/index");

    try {
      const message = await PrivateMessage.findById(messageId);
      if (!message) return;

      if (
        message.sender_id !== socket.userId &&
        message.receiver_id !== socket.userId
      )
        return;

      await PrivateMessage.deleteMessage(messageId);

      const partnerUserId =
        chatUserId ||
        (message.sender_id === socket.userId
          ? message.receiver_id
          : message.sender_id);

      const partnerSockets = userSocketMap.get(partnerUserId);
      const broadcastTo = new Set();

      if (partnerSockets) partnerSockets.forEach((id) => broadcastTo.add(id));
      broadcastTo.add(socket.id);

      broadcastTo.forEach((socketId) => {
        io.to(socketId).emit("message-deleted", { messageId });
      });
    } catch (err) {
      console.error("Error deleting message via socket:", err);
    }
  });

  // ─────────────────────────────────────────────
  // Typing Indicator (Private)
  // ─────────────────────────────────────────────
  socket.on("typing", ({ receiverId, isTyping, username }) => {
    const receiverSocketIds = userSocketMap.get(receiverId);
    if (receiverSocketIds) {
      receiverSocketIds.forEach((socketId) => {
        io.to(socketId).emit("user-typing", {
          userId: socket.userId,
          isTyping,
          username,
        });
      });
    }
  });

  // ─────────────────────────────────────────────
  // Group Message
  // ─────────────────────────────────────────────
  socket.on("group-message", (data) => {
    const { senderId, groupId, message, messageType, filePath, username } = data;

    const { GroupMessage } = require("./models/index");
    GroupMessage.create(groupId, senderId, message, messageType, filePath).catch((err) =>
      console.error("Error saving group message:", err)
    );

    io.emit("receive-group-message", {
      groupId,
      senderId,
      username,
      message,
      messageType,
      filePath,
      timestamp: new Date(),
    });
  });

  // ─────────────────────────────────────────────
  // Group Typing Indicator
  // ─────────────────────────────────────────────
  socket.on("group-typing", ({ groupId, isTyping, username }) => {
    io.emit("group-user-typing", {
      groupId,
      userId: socket.userId,
      isTyping,
      username,
    });
  });

  // ─────────────────────────────────────────────
  // Disconnect
  // ─────────────────────────────────────────────
  socket.on("disconnect", () => {
    if (socket.userId) {
      const socketSet = userSocketMap.get(socket.userId);
      if (socketSet) {
        socketSet.delete(socket.id);

        if (socketSet.size === 0) {
          userSocketMap.delete(socket.userId);

          const { User } = require("./models/index");
          User.updateStatus(socket.userId, "offline").catch((err) =>
            console.error("Error updating user status:", err)
          );

          // Broadcast to all that this user is now offline
          io.emit("user-offline", { userId: socket.userId, status: "offline" });
          console.log(`📍 User ${socket.username} (${socket.userId}) is offline`);
        }
      }
    }
    console.log("❌ User disconnected:", socket.id);
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "Server is running" });
});

const PORT = process.env.PORT || 3000;

function startServer(port) {
  if (server.listening) {
    console.log(`✅ Server is already running on port ${server.address().port}`);
    return;
  }
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
});
  const httpServer = server.listen(port, () => {
    console.log(`
╔════════════════════════════════════════╗
║  🚀 Chat App Server Running            ║
║  Port: ${port}                          ║
║  URL: http://localhost:${port}         ║
╚════════════════════════════════════════╝
    `);
  });

  httpServer.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`⚠️  Port ${port} is in use. Trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      throw err;
    }
  });
}

startServer(PORT);
