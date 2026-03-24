// ================ Global Variables ================
let socket = null;
let currentUserId = null;
let currentUsername = null;
let currentUserEmail = null;
let currentChatId = null;
let currentChatType = null; // 'private' or 'group'
let token = null;
let allUsers = [];
let blockedUsers = [];
let showingAllUsers = true;

// ================ Voice Recording Variables ================
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingStartTime = null;
let recordingTimer = null;

// ================ Delete Chat / Long Press Variables ================
let deletePressTimer = null;
const LONG_PRESS_DURATION = 600;

function setupMessageDeletionHandlers() {
  const messagesEl = document.getElementById("messages");
  if (!messagesEl) return;

  const clearTimer = () => {
    if (deletePressTimer) {
      clearTimeout(deletePressTimer);
      deletePressTimer = null;
    }
  };

  messagesEl.addEventListener("mouseenter", (e) => {
    const messageEl = e.target.closest(".message");
    if (!messageEl) return;
    const messageId = messageEl.getAttribute("data-message-id");
    if (!messageId) return;
    showDeleteButton(messageEl, messageId);
  }, true);

  messagesEl.addEventListener("mouseleave", (e) => {
    const messageEl = e.target.closest(".message");
    if (!messageEl) return;
    const deleteBtn = messageEl.querySelector(".delete-message-btn");
    if (deleteBtn) deleteBtn.remove();
  }, true);

  messagesEl.addEventListener("touchstart", (e) => {
    const messageEl = e.target.closest(".message");
    if (!messageEl) return;
    const messageId = messageEl.getAttribute("data-message-id");
    if (!messageId) return;
    deletePressTimer = setTimeout(() => {
      showDeleteButton(messageEl, messageId);
    }, LONG_PRESS_DURATION);
  });

  ["touchend", "touchcancel", "touchmove"].forEach((evt) => {
    messagesEl.addEventListener(evt, clearTimer);
  });

  messagesEl.addEventListener("click", async (e) => {
    if (!e.target.classList.contains("delete-message-btn")) return;
    const messageEl = e.target.closest(".message");
    if (!messageEl) return;
    const messageId = messageEl.getAttribute("data-message-id");
    if (!messageId) return;
    await deleteMessage(messageId);
  });
}

function showDeleteButton(messageEl, messageId) {
  if (messageEl.querySelector(".delete-message-btn")) return;
  const isOwn = messageEl.classList.contains("own");
  const btn = document.createElement("button");
  btn.className = "delete-message-btn";
  btn.textContent = "🗑️";
  btn.title = "Delete message";
  btn.style.position = "absolute";
  btn.style.bottom = "8px";
  btn.style.left = isOwn ? "8px" : "auto";
  btn.style.right = isOwn ? "auto" : "8px";
  btn.style.border = "none";
  btn.style.background = "rgba(255, 0, 0, 0.95)";
  btn.style.color = "#fff";
  btn.style.padding = "4px 8px";
  btn.style.borderRadius = "6px";
  btn.style.cursor = "pointer";
  btn.style.zIndex = "30";
  btn.style.fontSize = "14px";
  btn.style.boxShadow = "0 2px 5px rgba(0,0,0,0.35)";
  messageEl.style.position = "relative";
  messageEl.appendChild(btn);
}

async function deleteMessage(messageId) {
  try {
    const response = await fetch(`/api/users/private-messages/${messageId}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.error("Failed to delete message", await response.text());
      return;
    }

    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageEl) messageEl.remove();

    if (socket && socket.connected) {
      const partnerUserId = currentChatType === "private" ? currentChatId : null;
      socket.emit("delete-message", { messageId, chatUserId: partnerUserId });
    }
  } catch (error) {
    console.error("Error deleting message", error);
  }
}

// ================ Initialize Socket Connection ================
function initializeSocket() {
  if (!socket) {
    socket = io();
    setupSocketListeners();
  }
}

// ================ Auth Handlers ================
let otpTimers = {};
let pendingOTPEmail = {};

function validateGmail(email) {
  return /^\S+@gmail\.com$/i.test(email.trim());
}

function switchAuthTab(tab) {
  document.querySelectorAll(".auth-tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".auth-form").forEach((f) => f.classList.remove("active"));

  event.target.classList.add("active");
  document.getElementById(`${tab}-form`).classList.add("active");

  document.querySelectorAll(`#${tab}-form .auth-step`).forEach((step) => step.classList.remove("active"));
  document.getElementById(`${tab}-step-1`).classList.add("active");

  document.getElementById(`${tab}-error`).textContent = "";
  document.getElementById(`${tab}-otp-error`).textContent = "";

  if (tab === "login") {
    document.getElementById("login-email").value = "";
    document.getElementById("login-otp").value = "";
  } else {
    document.getElementById("register-username").value = "";
    document.getElementById("register-email").value = "";
    document.getElementById("register-otp").value = "";
  }
}

async function handleSendOTP(type) {
  const errorEl = document.getElementById(`${type}-error`);
  const otpErrorEl = document.getElementById(`${type}-otp-error`);

  let email, username;

  if (type === "login") {
    email = document.getElementById("login-email").value;
  } else {
    email = document.getElementById("register-email").value;
    username = document.getElementById("register-username").value;
  }

  errorEl.textContent = "";
  otpErrorEl.textContent = "";

  if (!email) {
    errorEl.textContent = "Please enter your email";
    return;
  }

  if (!validateGmail(email)) {
    errorEl.textContent = "Invalid email";
    return;
  }

  try {
    const response = await fetch("/api/auth/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (response.ok) {
      pendingOTPEmail[type] = email;
      document.getElementById(`${type}-step-1`).classList.remove("active");
      document.getElementById(`${type}-step-2`).classList.add("active");
      document.getElementById(`${type}-email-display`).textContent = email;
      startOTPTimer(type, data.expiresIn);
      document.getElementById(`${type}-otp`).focus();
    } else {
      errorEl.textContent = data.error || "Failed to send OTP";
    }
  } catch (error) {
    errorEl.textContent = "Network error";
    console.error("Send OTP error:", error);
  }
}

function startOTPTimer(type, seconds = 120) {
  let remaining = seconds;

  if (otpTimers[type]) clearInterval(otpTimers[type]);

  const timerEl = document.getElementById(`${type}-timer`);
  updateTimerDisplay(timerEl, remaining);

  otpTimers[type] = setInterval(() => {
    remaining--;
    updateTimerDisplay(timerEl, remaining);
    if (remaining <= 0) {
      clearInterval(otpTimers[type]);
      delete otpTimers[type];
      timerEl.style.color = "#e74c3c";
    }
  }, 1000);
}

function updateTimerDisplay(el, seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  el.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
}

async function handleVerifyOTP(type) {
  const otpCode = document.getElementById(`${type}-otp`).value;
  const otpErrorEl = document.getElementById(`${type}-otp-error`);
  const email = pendingOTPEmail[type];

  otpErrorEl.textContent = "";

  if (!otpCode || otpCode.length !== 6) {
    otpErrorEl.textContent = "Please enter a valid 6-digit code";
    return;
  }

  try {
    let username = null;
    if (type === "register") {
      username = document.getElementById("register-username").value;
      if (!username) {
        otpErrorEl.textContent = "Username is required";
        return;
      }
    }

    const response = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, otp: otpCode, username }),
    });

    const data = await response.json();

    if (response.ok) {
      if (otpTimers[type]) {
        clearInterval(otpTimers[type]);
        delete otpTimers[type];
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("userId", data.userId.toString());
      localStorage.setItem("username", data.username);

      token = data.token;
      currentUserId = data.userId;
      currentUsername = data.username;
      currentUserEmail = data.email;

      initializeSocket();
      showChatPage();

      // ✅ FIX: Wait for socket to connect before emitting user-login
      if (socket.connected) {
        socket.emit("user-login", { userId: currentUserId, username: currentUsername });
      } else {
        socket.once("connect", () => {
          socket.emit("user-login", { userId: currentUserId, username: currentUsername });
        });
      }

      setTimeout(loadChatData, 500);
    } else {
      otpErrorEl.textContent = data.error || "Verification failed";
    }
  } catch (error) {
    otpErrorEl.textContent = "Network error";
    console.error("Verify OTP error:", error);
  }
}

function handleBackToEmail(type) {
  document.getElementById(`${type}-step-2`).classList.remove("active");
  document.getElementById(`${type}-step-1`).classList.add("active");
  document.getElementById(`${type}-otp`).value = "";
  document.getElementById(`${type}-otp-error`).textContent = "";

  if (otpTimers[type]) {
    clearInterval(otpTimers[type]);
    delete otpTimers[type];
  }
}

function handleLogout() {
  if (socket && socket.connected) {
    socket.disconnect();
  }

  localStorage.removeItem("token");
  localStorage.removeItem("userId");
  localStorage.removeItem("username");

  currentUserId = null;
  currentUsername = null;
  currentUserEmail = null;
  token = null;
  socket = null;
  otpTimers = {};
  blockedUsers = [];

  document.getElementById("chat-page").classList.remove("active");
  document.getElementById("auth-page").classList.add("active");
  document.getElementById("messages").innerHTML = "";
  document.getElementById("users-list").innerHTML = "";
  document.getElementById("groups-list").innerHTML = "";

  document.getElementById("login-email").value = "";
  document.getElementById("login-otp").value = "";
  document.getElementById("register-username").value = "";
  document.getElementById("register-email").value = "";
  document.getElementById("register-otp").value = "";
  document.getElementById("login-error").textContent = "";
  document.getElementById("login-otp-error").textContent = "";
  document.getElementById("register-error").textContent = "";
  document.getElementById("register-otp-error").textContent = "";
}

// ================ Block/Unblock Users ================
async function blockUser(userId, username) {
  try {
    const response = await fetch("/api/blocked/block", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ blockedUserId: userId }),
    });

    const data = await response.json();

    if (response.ok) {
      blockedUsers.push(userId);
      alert(`${username} has been blocked`);

      if (currentChatType === "private" && currentChatId === userId) {
        document.getElementById("messages").innerHTML = "";
        currentChatId = null;
        currentChatType = null;
      }

      loadChatData();
    } else {
      alert(data.error || "Failed to block user");
    }
  } catch (error) {
    console.error("Block user error:", error);
    alert("Error blocking user");
  }
}

async function unblockUser(userId, username) {
  try {
    const response = await fetch("/api/blocked/unblock", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ blockedUserId: userId }),
    });

    const data = await response.json();

    if (response.ok) {
      blockedUsers = blockedUsers.filter((id) => id !== userId);
      alert(`${username} has been unblocked`);
      loadChatData();
    } else {
      alert(data.error || "Failed to unblock user");
    }
  } catch (error) {
    console.error("Unblock user error:", error);
    alert("Error unblocking user");
  }
}

async function loadBlockedUsers() {
  try {
    const response = await fetch("/api/blocked/list", {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json();
    if (response.ok) {
      blockedUsers = data.blockedUsers || [];
    }
  } catch (error) {
    console.error("Load blocked users error:", error);
  }
}

// ================ Page Navigation ================
function showChatPage() {
  document.getElementById("auth-page").classList.remove("active");
  document.getElementById("chat-page").classList.add("active");

  setupMessageDeletionHandlers();

  const emptyMessage = document.getElementById("empty-chat-message");
  if (emptyMessage) emptyMessage.style.display = "flex";

  if (currentUserEmail === "adminview123@gmail.com") {
    document.getElementById("admin-btn").style.display = "inline-block";
  }
}

// ================ Load Chat Data ================
async function loadChatData() {
  if (!token) {
    console.error("❌ No token available for loadChatData");
    return;
  }

  try {
    const [usersRes, groupsRes] = await Promise.all([
      fetch(showingAllUsers ? "/api/users/all" : "/api/users/chatted", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch("/api/users/groups", { headers: { Authorization: `Bearer ${token}` } }),
    ]);

    if (!usersRes.ok) throw new Error(`Users fetch failed: ${usersRes.status}`);
    if (!groupsRes.ok) throw new Error(`Groups fetch failed: ${groupsRes.status}`);

    const users = await usersRes.json();
    const groups = await groupsRes.json();

    allUsers = users.filter((u) => u.id !== currentUserId);

    displayUsers(allUsers);
    displayGroups(groups);

    // ✅ FIX: After displaying users, ask server who is currently online
    // so status indicators are correct immediately after load
    if (socket && socket.connected) {
      socket.emit("get-online-users");
    }

    console.log("✅ Chat data loaded successfully");
  } catch (error) {
    console.error("❌ Load chat data error:", error);
    throw error;
  }
}

// ================ Display Users ================
function displayUsers(users) {
  const usersList = document.getElementById("users-list");
  usersList.innerHTML = "";

  users.forEach((user) => {
    const isBlocked = blockedUsers.includes(user.id);
    const isOnline = user.status === "online";

    const userEl = document.createElement("div");
    userEl.className = "user-item";
    userEl.setAttribute("data-user-id", user.id);

    if (isBlocked) {
      const userContentEl = document.createElement("div");
      userContentEl.style.display = "flex";
      userContentEl.style.alignItems = "center";
      userContentEl.style.gap = "10px";
      userContentEl.style.flex = "1";

      userContentEl.innerHTML = `
        <div class="avatar-container">
          <div class="avatar-blocked">🚫</div>
          <span class="status-indicator"></span>
        </div>
        <div class="user-info">
          <p>${user.username}</p>
          <span style="color: #e74c3c; font-size: 12px;">Blocked</span>
        </div>
      `;

      const unblockBtn = document.createElement("button");
      unblockBtn.className = "unblock-user-btn";
      unblockBtn.textContent = "Unblock";
      unblockBtn.onclick = (e) => {
        e.stopPropagation();
        unblockUser(user.id, user.username);
      };

      userEl.appendChild(userContentEl);
      userEl.appendChild(unblockBtn);
    } else {
      const userContentEl = document.createElement("div");
      userContentEl.style.display = "flex";
      userContentEl.style.alignItems = "center";
      userContentEl.style.gap = "10px";
      userContentEl.style.flex = "1";
      userContentEl.style.cursor = "pointer";

      userContentEl.innerHTML = `
        <div class="avatar-container">
          <img src="${user.avatar || "/default-avatar.svg"}" alt="${user.username}" class="user-avatar" />
          <span class="status-indicator ${isOnline ? "online" : ""}"></span>
        </div>
        <div class="user-info">
          <p>${user.username}</p>
          <span class="unread-badge" data-user-id="${user.id}" style="display: none;">📬 New message</span>
        </div>
      `;

      userContentEl.onclick = (event) =>
        selectChat(user.id, user.username, "private", user.avatar, event);

      const blockBtn = document.createElement("button");
      blockBtn.className = "block-user-btn";
      blockBtn.textContent = "Block";
      blockBtn.onclick = (e) => {
        e.stopPropagation();
        blockUser(user.id, user.username);
      };

      userEl.appendChild(userContentEl);
      userEl.appendChild(blockBtn);
    }

    usersList.appendChild(userEl);
  });
}

// ================ Display Groups ================
function displayGroups(groups) {
  const groupsList = document.getElementById("groups-list");
  groupsList.innerHTML = "";

  groups.forEach((group) => {
    const groupEl = document.createElement("div");
    groupEl.className = "group-item";
    groupEl.onclick = (event) => selectChat(group.id, group.name, "group", group.avatar, event);

    groupEl.innerHTML = `
      <img src="${group.avatar || "/default-group.svg"}" alt="${group.name}" class="group-avatar" />
      <div class="group-info">
        <p>${group.name}</p>
      </div>
    `;

    groupsList.appendChild(groupEl);
  });
}

// ================ Select Chat ================
async function selectChat(chatId, chatName, chatType, avatar, event) {
  currentChatId = chatId;
  currentChatType = chatType;

  const existingTypingEl = document.getElementById("typing-status");
  if (existingTypingEl) existingTypingEl.remove();

  const existingGroupTypingEl = document.getElementById("group-typing-status");
  if (existingGroupTypingEl) existingGroupTypingEl.remove();

  if (window.groupTypingUsers) window.groupTypingUsers.clear();

  const clickedItem = event?.target?.closest(".user-item, .group-item");
  document.querySelectorAll(".user-item, .group-item").forEach((el) => el.classList.remove("active"));
  if (clickedItem) clickedItem.classList.add("active");

  document.getElementById("chat-name").textContent = chatName;
  document.getElementById("messages").innerHTML = "";

  const emptyMessage = document.getElementById("empty-chat-message");
  if (emptyMessage) emptyMessage.style.display = "none";

  if (chatType === "private" && blockedUsers.includes(chatId)) {
    const chatStatusEl = document.getElementById("chat-status");
    chatStatusEl.innerHTML =
      '<span style="color: #e74c3c;">You have blocked this user. <button onclick="unblockUser(' +
      chatId +
      ", '" +
      chatName +
      "'\">Unblock</button></span>";
    document.getElementById("message-input").disabled = true;
    document.querySelector(".send-btn").disabled = true;
    return;
  }

  document.getElementById("message-input").disabled = false;
  document.querySelector(".send-btn").disabled = false;

  if (window.innerWidth < 768) {
    const chatArea = document.querySelector(".chat-area");
    const sidebar = document.querySelector(".sidebar");
    const backBtn = document.getElementById("mobile-back-btn");
    chatArea.classList.add("active");
    sidebar.classList.add("hidden");
    if (backBtn) backBtn.style.display = "block";
  }

  if (chatType === "private") {
    document.getElementById("chat-status").textContent = "Private Chat";
    document.getElementById("group-info-btn").style.display = "none";

    const userItem = document.querySelector(`[data-user-id="${chatId}"]`);
    if (userItem) {
      const unreadBadge = userItem.querySelector(".unread-badge");
      if (unreadBadge) unreadBadge.style.display = "none";
    }

    try {
      const response = await fetch(`/api/users/private-messages/${chatId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const messages = await response.json();
      displayMessages(messages, "private");
      markMessagesAsRead(messages, chatId);
    } catch (error) {
      console.error("Load messages error:", error);
    }
  } else if (chatType === "group") {
    document.getElementById("chat-status").textContent = "Group Chat";
    document.getElementById("group-info-btn").style.display = "block";

    try {
      const response = await fetch(`/api/users/groups/${chatId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const messages = await response.json();
      displayMessages(messages, "group");
    } catch (error) {
      console.error("Load group messages error:", error);
    }
  }
}

// ================ Back to Chat List (Mobile) ================
function goBackToChatList() {
  const chatArea = document.querySelector(".chat-area");
  const sidebar = document.querySelector(".sidebar");
  const backBtn = document.getElementById("mobile-back-btn");

  chatArea.classList.remove("active");
  sidebar.classList.remove("hidden");
  if (backBtn) backBtn.style.display = "none";

  currentChatId = null;
  currentChatType = null;
  document.getElementById("messages").innerHTML = "";
  document.getElementById("chat-name").textContent = "";
  document.getElementById("chat-status").textContent = "";

  const emptyMessage = document.getElementById("empty-chat-message");
  if (emptyMessage) emptyMessage.style.display = "flex";

  document.querySelectorAll(".user-item, .group-item").forEach((el) => el.classList.remove("active"));
}

// ================ Display Messages ================
function displayMessages(messages, type) {
  const messagesEl = document.getElementById("messages");
  messagesEl.innerHTML = "";

  messages.forEach((msg) => {
    if (blockedUsers.includes(msg.sender_id)) return;

    const isOwn = msg.sender_id === currentUserId;
    const messageEl = document.createElement("div");
    messageEl.className = `message ${isOwn ? "own" : ""}`;
    messageEl.setAttribute("data-message-id", msg.id);

    let content = "";
    if (msg.message_type === "text") {
      content = `<div class="message-bubble text">${escapeHtml(msg.message)}</div>`;
    } else if (msg.message_type === "image") {
      content = `<div class="message-bubble image"><img src="${msg.file_path}" /></div>`;
    } else if (msg.message_type === "voice") {
      const msgId = `voice-${Math.random().toString(36).substr(2, 9)}`;
      content = `<div class="message-bubble voice">
        <div class="voice-player" id="${msgId}">
          <button class="voice-play-btn" onclick="playVoiceMessage(this)" data-src="${msg.file_path}">▶</button>
          <div class="voice-duration">0:00</div>
        </div>
      </div>`;
    }

    let statusTick = "";
    if (isOwn) {
      if (msg.message_status === "read") {
        statusTick = '<span class="message-status read-tick">✓✓</span>';
      } else if (msg.message_status === "delivered") {
        statusTick = '<span class="message-status delivered-tick">✓✓</span>';
      } else {
        statusTick = '<span class="message-status sent-tick">✓</span>';
      }
    }

    messageEl.innerHTML = `
      ${!isOwn ? `<div class="message-sender">${msg.username}</div>` : ""}
      ${content}
      <div class="message-time">${statusTick} ${new Date(msg.created_at).toLocaleTimeString()}</div>
    `;

    messagesEl.appendChild(messageEl);
  });

  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ================ Mark Messages as Read ================
function markMessagesAsRead(messages, chatId) {
  const unreadMessages = messages.filter(
    (msg) =>
      msg.sender_id === parseInt(chatId) &&
      (msg.message_status === "sent" || msg.message_status === "delivered")
  );

  unreadMessages.forEach((msg) => {
    if (socket && socket.connected) {
      socket.emit("message-read", { messageId: msg.id, senderId: msg.sender_id });
    }
  });
}

// ================ Setup Socket Listeners ================
function setupSocketListeners() {
  socket.on("receive-private-message", (data) => {
    if (!(currentChatType === "private" && currentChatId === data.senderId)) {
      const userItem = document.querySelector(`[data-user-id="${data.senderId}"]`);
      if (userItem) {
        const unreadBadge = userItem.querySelector(".unread-badge");
        if (unreadBadge) unreadBadge.style.display = "block";
      }
    }

    if (socket && socket.connected) {
      socket.emit("message-delivered", {
        messageId: data.messageId,
        receiverId: currentUserId,
      });
    }

    if (currentChatType === "private" && currentChatId === data.senderId) {
      const emptyMessage = document.getElementById("empty-chat-message");
      if (emptyMessage) emptyMessage.remove();

      const messagesEl = document.getElementById("messages");
      const messageEl = document.createElement("div");
      messageEl.className = "message";
      messageEl.setAttribute("data-message-id", data.messageId);

      let content = "";
      if (data.messageType === "text") {
        content = `<div class="message-bubble text">${escapeHtml(data.message)}</div>`;
      } else if (data.messageType === "image") {
        content = `<div class="message-bubble image"><img src="${data.filePath}" /></div>`;
      } else if (data.messageType === "voice") {
        const msgId = `voice-${Math.random().toString(36).substr(2, 9)}`;
        content = `<div class="message-bubble voice">
          <div class="voice-player" id="${msgId}">
            <button class="voice-play-btn" onclick="playVoiceMessage(this)" data-src="${data.filePath}">▶</button>
            <div class="voice-duration">0:00</div>
          </div>
        </div>`;
      }

      messageEl.innerHTML = `
        ${content}
        <div class="message-time">${new Date().toLocaleTimeString()}</div>
      `;

      messagesEl.appendChild(messageEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  });

  socket.on("receive-group-message", (data) => {
    if (currentChatType === "group" && currentChatId === data.groupId) {
      const emptyMessage = document.getElementById("empty-chat-message");
      if (emptyMessage) emptyMessage.remove();

      const messagesEl = document.getElementById("messages");
      const messageEl = document.createElement("div");
      messageEl.className = `message ${data.senderId === currentUserId ? "own" : ""}`;

      let content = "";
      if (data.messageType === "text") {
        content = `<div class="message-bubble text">${escapeHtml(data.message)}</div>`;
      } else if (data.messageType === "image") {
        content = `<div class="message-bubble image"><img src="${data.filePath}" /></div>`;
      } else if (data.messageType === "voice") {
        const msgId = `voice-${Math.random().toString(36).substr(2, 9)}`;
        content = `<div class="message-bubble voice">
          <div class="voice-player" id="${msgId}">
            <button class="voice-play-btn" onclick="playVoiceMessage(this)" data-src="${data.filePath}">▶</button>
            <div class="voice-duration">0:00</div>
          </div>
        </div>`;
      }

      messageEl.innerHTML = `
        ${data.senderId !== currentUserId ? `<div class="message-sender">${data.username}</div>` : ""}
        ${content}
        <div class="message-time">${new Date().toLocaleTimeString()}</div>
      `;

      messagesEl.appendChild(messageEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  });

  // ✅ FIX: user-online — safely update status indicator
  socket.on("user-online", (data) => {
    const userEl = document.querySelector(`[data-user-id="${data.userId}"]`);
    if (userEl) {
      const indicator = userEl.querySelector(".status-indicator");
      if (indicator) indicator.classList.add("online");
    }
  });

  // ✅ FIX: user-offline — safely update status indicator
  socket.on("user-offline", (data) => {
    const userEl = document.querySelector(`[data-user-id="${data.userId}"]`);
    if (userEl) {
      const indicator = userEl.querySelector(".status-indicator");
      if (indicator) indicator.classList.remove("online");
    }
  });

  // ✅ FIX: Receive full list of currently online users from server
  // This fires right after user-login so all already-online users show green dots
  socket.on("online-users-list", (data) => {
    const { onlineUserIds } = data;
    onlineUserIds.forEach((userId) => {
      const userEl = document.querySelector(`[data-user-id="${userId}"]`);
      if (userEl) {
        const indicator = userEl.querySelector(".status-indicator");
        if (indicator) indicator.classList.add("online");
      }
    });
  });

  socket.on("user-typing", (data) => {
    if (currentChatType === "private" && currentChatId === data.userId) {
      if (data.isTyping) {
        const typingStatusEl = document.getElementById("typing-status");
        if (!typingStatusEl) {
          const el = document.createElement("p");
          el.id = "typing-status";
          el.style.color = "#999";
          el.style.fontSize = "12px";
          el.style.margin = "2px 0 0 0";
          el.textContent = `${data.username} is typing...`;
          document.querySelector(".chat-info").appendChild(el);
        }
      } else {
        const typingStatusEl = document.getElementById("typing-status");
        if (typingStatusEl) typingStatusEl.remove();
      }
    }
  });

  socket.on("group-user-typing", (data) => {
    if (currentChatType === "group" && currentChatId === data.groupId) {
      if (data.isTyping) {
        if (!window.groupTypingUsers) window.groupTypingUsers = new Set();
        window.groupTypingUsers.add(data.userId);

        let typingStatusEl = document.getElementById("group-typing-status");
        if (!typingStatusEl) {
          typingStatusEl = document.createElement("p");
          typingStatusEl.id = "group-typing-status";
          typingStatusEl.style.color = "#999";
          typingStatusEl.style.fontSize = "12px";
          typingStatusEl.style.margin = "2px 0 0 0";
          document.querySelector(".chat-info").appendChild(typingStatusEl);
        }

        const count = window.groupTypingUsers.size;
        typingStatusEl.textContent =
          count === 1 ? "Someone is typing..." : `${count} people are typing...`;
      } else {
        if (window.groupTypingUsers) {
          window.groupTypingUsers.delete(data.userId);
          const typingStatusEl = document.getElementById("group-typing-status");
          if (window.groupTypingUsers.size === 0) {
            if (typingStatusEl) typingStatusEl.remove();
          } else {
            const count = window.groupTypingUsers.size;
            typingStatusEl.textContent =
              count === 1 ? "Someone is typing..." : `${count} people are typing...`;
          }
        }
      }
    }
  });

  socket.on("message-status-update", (data) => {
    const { messageId, status } = data;
    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageEl) {
      const statusEl = messageEl.querySelector(".message-status");
      if (statusEl) {
        if (status === "read") {
          statusEl.className = "message-status read-tick";
          statusEl.textContent = "✓✓";
        } else if (status === "delivered") {
          statusEl.className = "message-status delivered-tick";
          statusEl.textContent = "✓✓";
        } else if (status === "sent") {
          statusEl.className = "message-status sent-tick";
          statusEl.textContent = "✓";
        }
      }
    }
  });

  socket.on("message-deleted", (data) => {
    const { messageId } = data;
    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageEl) messageEl.remove();
  });

  socket.on("message-sent", (data) => {
    const { messageId } = data;
    const ownMessages = document.querySelectorAll(".message.own:not([data-message-id])");
    if (ownMessages.length > 0) {
      const lastMessageEl = ownMessages[ownMessages.length - 1];
      lastMessageEl.setAttribute("data-message-id", messageId);
    }
  });
}

// ================ Send Message ================
async function sendMessage() {
  const input = document.getElementById("message-input");
  const message = input.value.trim();

  if (!message || !currentChatId) return;

  if (currentChatType === "private" && blockedUsers.includes(currentChatId)) {
    alert("You cannot send messages to a blocked user. Please unblock them first.");
    return;
  }

  if (currentChatType === "private") {
    if (socket && socket.connected) {
      socket.emit("private-message", {
        senderId: currentUserId,
        receiverId: currentChatId,
        message,
        messageType: "text",
      });
    }

    const emptyMessage = document.getElementById("empty-chat-message");
    if (emptyMessage) emptyMessage.remove();

    const messagesEl = document.getElementById("messages");
    const messageEl = document.createElement("div");
    messageEl.className = "message own";
    messageEl.setAttribute("data-message-id", `local-${Date.now()}`);
    messageEl.innerHTML = `
      <div class="message-bubble text">${escapeHtml(message)}</div>
      <div class="message-time">
        <span class="message-status sent-tick">✓</span>
        ${new Date().toLocaleTimeString()}
      </div>
    `;
    messagesEl.appendChild(messageEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    if (!showingAllUsers) setTimeout(() => loadChatData(), 100);
  } else if (currentChatType === "group") {
    if (socket && socket.connected) {
      socket.emit("group-message", {
        groupId: currentChatId,
        senderId: currentUserId,
        message,
        messageType: "text",
        username: currentUsername,
      });
    }

    const emptyMessage = document.getElementById("empty-chat-message");
    if (emptyMessage) emptyMessage.remove();
  }

  input.value = "";
}

// ================ Typing Indicators ================
let typingTimeout;
document.getElementById("message-input").addEventListener("input", () => {
  if (!socket || !socket.connected) return;

  if (currentChatType === "private" && currentChatId) {
    socket.emit("typing", { receiverId: currentChatId, isTyping: true, username: currentUsername });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("typing", { receiverId: currentChatId, isTyping: false });
    }, 2000);
  } else if (currentChatType === "group" && currentChatId) {
    socket.emit("group-typing", { groupId: currentChatId, isTyping: true, username: currentUsername });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit("group-typing", { groupId: currentChatId, isTyping: false });
    }, 2000);
  }
});

// ================ Toggle All Users View ================
function toggleAllUsersView() {
  showingAllUsers = !showingAllUsers;
  const btn = document.getElementById("show-all-users-btn");
  if (showingAllUsers) {
    btn.textContent = "−";
    btn.title = "Show Chatted Users Only";
  } else {
    btn.textContent = "+";
    btn.title = "Show All Users";
  }
  loadChatData();
}

// ================ Search Users ================
function searchUsers() {
  const query = document.getElementById("search-users").value.toLowerCase();
  const filtered = allUsers.filter((u) => u.username.toLowerCase().includes(query));
  displayUsers(filtered);
}

// ================ File Upload & Voice Recording ================
function uploadFile(type) {
  if (type === "voice") {
    showVoiceOptions();
  } else {
    const input = document.getElementById("file-input");
    input.dataset.type = type;
    input.click();
  }
}

function showVoiceOptions() {
  const choice = confirm("Choose action:\n\nOK: Record Voice\nCancel: Upload Voice File");
  if (choice) {
    toggleVoiceRecording();
  } else {
    const input = document.getElementById("file-input");
    input.dataset.type = "voice";
    input.accept = ".mp3,.wav,.m4a,.ogg,.webm";
    input.click();
  }
}

async function toggleVoiceRecording() {
  if (!isRecording) {
    startVoiceRecording();
  } else {
    stopVoiceRecording();
  }
}

async function startVoiceRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    isRecording = true;
    recordingStartTime = Date.now();

    document.querySelector(".voice-recording-ui").style.display = "flex";
    document.querySelector(".action-btn[title='Send Voice']").style.background = "#ff4444";
    document.querySelector(".action-btn[title='Send Voice']").style.color = "white";
    document.getElementById("message-input").disabled = true;
    document.querySelector(".send-btn").disabled = true;

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      isRecording = false;
      const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
      audioChunks = [];

      document.querySelector(".voice-recording-ui").style.display = "none";
      document.querySelector(".action-btn[title='Send Voice']").style.background = "";
      document.querySelector(".action-btn[title='Send Voice']").style.color = "";
      document.getElementById("message-input").disabled = false;
      document.querySelector(".send-btn").disabled = false;

      window.voiceMessageBlob = audioBlob;
      showVoicePreview();
    };

    mediaRecorder.start();
    startRecordingTimer();
  } catch (error) {
    console.error("Microphone access denied:", error);
    alert("Please allow microphone access to send voice messages");
  }
}

function stopVoiceRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    clearInterval(recordingTimer);
    mediaRecorder.stream.getTracks().forEach((track) => track.stop());
  }
}

function startRecordingTimer() {
  recordingTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    document.getElementById("recording-timer").textContent =
      `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }, 100);
}

function showVoicePreview() {
  document.getElementById("voice-preview-ui").style.display = "flex";
  document.getElementById("message-input").style.display = "none";

  const waveform = document.querySelector(".voice-waveform");
  waveform.innerHTML = "";
  for (let i = 0; i < 30; i++) {
    const bar = document.createElement("div");
    bar.className = "waveform-bar";
    bar.style.animationDelay = `${i * 0.05}s`;
    waveform.appendChild(bar);
  }
}

async function sendVoiceMessage() {
  const blob = window.voiceMessageBlob;
  if (!blob) return;

  if (currentChatType === "private" && blockedUsers.includes(currentChatId)) {
    alert("You cannot send messages to a blocked user. Please unblock them first.");
    return;
  }

  const formData = new FormData();
  formData.append("file", blob, "voice-message.wav");

  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = await response.json();
    const filePath = data.filePath;

    const messagesEl = document.getElementById("messages");
    const messageEl = document.createElement("div");
    messageEl.className = "message own";
    const msgId = `voice-${Math.random().toString(36).substr(2, 9)}`;
    messageEl.innerHTML = `
      <div class="message-bubble voice">
        <div class="voice-player" id="${msgId}">
          <button class="voice-play-btn" onclick="playVoiceMessage(this)" data-src="${filePath}">▶</button>
          <div class="voice-duration">0:00</div>
        </div>
      </div>
      <div class="message-time">${new Date().toLocaleTimeString()}</div>
    `;
    messagesEl.appendChild(messageEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    if (currentChatType === "private") {
      socket.emit("private-message", {
        senderId: currentUserId,
        receiverId: currentChatId,
        message: "",
        messageType: "voice",
        filePath,
      });
    } else if (currentChatType === "group") {
      socket.emit("group-message", {
        groupId: currentChatId,
        senderId: currentUserId,
        message: "",
        messageType: "voice",
        filePath,
        username: currentUsername,
      });
    }

    document.getElementById("voice-preview-ui").style.display = "none";
    document.getElementById("message-input").style.display = "flex";
    window.voiceMessageBlob = null;
  } catch (error) {
    console.error("Voice upload error:", error);
    alert("Error sending voice message");
  }
}

function cancelVoiceMessage() {
  window.voiceMessageBlob = null;
  document.getElementById("voice-preview-ui").style.display = "none";
  document.getElementById("message-input").style.display = "flex";
}

async function handleFileUpload() {
  const input = document.getElementById("file-input");
  const file = input.files[0];
  const type = input.dataset.type;

  if (!file) return;

  if (currentChatType === "private" && blockedUsers.includes(currentChatId)) {
    alert("You cannot send messages to a blocked user. Please unblock them first.");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch("/api/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = await response.json();
    const filePath = data.filePath;

    if (type === "voice") {
      const messagesEl = document.getElementById("messages");
      const messageEl = document.createElement("div");
      messageEl.className = "message own";
      const msgId = `voice-${Math.random().toString(36).substr(2, 9)}`;
      messageEl.innerHTML = `
        <div class="message-bubble voice">
          <div class="voice-player" id="${msgId}">
            <button class="voice-play-btn" onclick="playVoiceMessage(this)" data-src="${filePath}">▶</button>
            <div class="voice-duration">0:00</div>
          </div>
        </div>
        <div class="message-time">${new Date().toLocaleTimeString()}</div>
      `;
      messagesEl.appendChild(messageEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    if (currentChatType === "private") {
      socket.emit("private-message", {
        senderId: currentUserId,
        receiverId: currentChatId,
        message: "",
        messageType: type,
        filePath,
      });
    } else if (currentChatType === "group") {
      socket.emit("group-message", {
        groupId: currentChatId,
        senderId: currentUserId,
        message: "",
        messageType: type,
        filePath,
        username: currentUsername,
      });
    }

    input.value = "";
    input.accept = ".jpg,.jpeg,.png,.gif,.mp3,.wav,.m4a";
  } catch (error) {
    console.error("Upload error:", error);
  }
}

// ================ Group Modal ================
function openCreateGroupModal() {
  document.getElementById("create-group-modal").classList.add("active");
}

function closeCreateGroupModal() {
  document.getElementById("create-group-modal").classList.remove("active");
}

async function createGroup() {
  const name = document.getElementById("group-name").value;
  const description = document.getElementById("group-description").value;

  if (!name) {
    alert("Group name is required");
    return;
  }

  try {
    const response = await fetch("/api/users/groups", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name, description }),
    });

    const data = await response.json();

    if (response.ok) {
      alert("Group created successfully!");
      loadChatData();
      closeCreateGroupModal();
      document.getElementById("group-name").value = "";
      document.getElementById("group-description").value = "";
    } else {
      alert("Error creating group: " + (data.error || "Unknown error"));
    }
  } catch (error) {
    alert("Network error while creating group: " + error.message);
  }
}

// ================ Profile Modal ================
function openUserProfile() {
  document.getElementById("profile-modal").classList.add("active");
  loadUserProfile();
}

function closeProfileModal() {
  document.getElementById("profile-modal").classList.remove("active");
}

async function loadUserProfile() {
  try {
    const response = await fetch("/api/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const user = await response.json();

    document.getElementById("profile-username").textContent = user.username;
    document.getElementById("profile-email").textContent = user.email;
    document.getElementById("profile-avatar").src = user.avatar || "/default-avatar.svg";
    document.getElementById("profile-bio").value = user.bio || "";
  } catch (error) {
    console.error("Load profile error:", error);
  }
}

async function updateProfile() {
  const bio = document.getElementById("profile-bio").value;
  const fileInput = document.getElementById("profile-file-input");
  const file = fileInput.files[0];

  const formData = new FormData();
  formData.append("bio", bio);
  if (file) formData.append("avatar", file);

  try {
    const response = await fetch("/api/users/profile", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = await response.json();

    if (response.ok) {
      if (data.user.avatar) {
        document.getElementById("profile-avatar").src = data.user.avatar + "?t=" + Date.now();
      }
      alert("Profile updated successfully!");
      fileInput.value = "";
      setTimeout(() => loadChatData(), 100);
    } else {
      alert("Error updating profile: " + (data.error || "Unknown error"));
    }
  } catch (error) {
    alert("Network error while updating profile: " + error.message);
  }
}

function previewAvatar() {
  const fileInput = document.getElementById("profile-file-input");
  const file = fileInput.files[0];

  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      document.getElementById("profile-avatar").src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

// ================ Group Info ================
function toggleGroupInfo() {
  document.getElementById("group-info-sidebar").classList.toggle("active");
  loadGroupMembers();
}

async function loadGroupMembers() {
  if (currentChatType !== "group") return;

  try {
    const response = await fetch(`/api/users/groups/${currentChatId}/members`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const members = await response.json();

    const membersList = document.getElementById("group-members");
    membersList.innerHTML = "";

    members.forEach((member) => {
      const memberEl = document.createElement("div");
      memberEl.className = "member-item";
      memberEl.innerHTML = `
        <img src="${member.avatar || "/default-avatar.svg"}" />
        <div>
          <p>${member.username}</p>
          <p style="font-size: 11px; color: #999;">${member.status}</p>
        </div>
      `;
      membersList.appendChild(memberEl);
    });
  } catch (error) {
    console.error("Load group members error:", error);
  }
}

function openAddMemberModal() {
  document.getElementById("add-member-modal").classList.add("active");
  const select = document.getElementById("member-select");
  select.innerHTML = "";
  allUsers.forEach((user) => {
    const option = document.createElement("option");
    option.value = user.id;
    option.textContent = user.username;
    select.appendChild(option);
  });
}

function closeAddMemberModal() {
  document.getElementById("add-member-modal").classList.remove("active");
}

function addMemberToGroup() {
  openAddMemberModal();
}

async function confirmAddMember() {
  const userId = parseInt(document.getElementById("member-select").value);

  try {
    await fetch(`/api/users/groups/${currentChatId}/members`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId }),
    });

    loadGroupMembers();
    closeAddMemberModal();
  } catch (error) {
    console.error("Add member error:", error);
  }
}

// ================ Utility Functions ================
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ================ Initialize App ================
async function initializeApp() {
  token = localStorage.getItem("token");
  const userId = localStorage.getItem("userId");

  if (token && userId) {
    currentUserId = parseInt(userId);

    showChatPage();

    try {
      initializeSocket();
    } catch (error) {
      console.error("❌ Socket initialization error:", error);
    }

    try {
      const response = await fetch("/api/users/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const userData = await response.json();
        currentUsername = userData.username;
        currentUserEmail = userData.email;

        // ✅ FIX: Wait for socket to connect before emitting user-login
        if (socket) {
          if (socket.connected) {
            socket.emit("user-login", { userId: currentUserId, username: currentUsername });
          } else {
            socket.once("connect", () => {
              socket.emit("user-login", { userId: currentUserId, username: currentUsername });
            });
          }
        }

        await loadChatData();
        await loadBlockedUsers();
      } else {
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        token = null;
        currentUserId = null;
        document.getElementById("chat-page").classList.remove("active");
        document.getElementById("auth-page").classList.add("active");
      }
    } catch (error) {
      console.warn("⚠️ Network error during verification:", error.message);
      try {
        await loadChatData();
      } catch (loadError) {
        console.error("❌ Failed to load chat data:", loadError);
      }
    }
  } else {
    document.getElementById("chat-page").classList.remove("active");
    document.getElementById("auth-page").classList.add("active");
  }
}

// ================ Voice Player ================
let currentAudioPlayer = null;

function playVoiceMessage(button) {
  const src = button.dataset.src;
  const voicePlayer = button.parentElement;

  if (currentAudioPlayer && currentAudioPlayer !== voicePlayer) {
    currentAudioPlayer.querySelector(".voice-play-btn").textContent = "▶";
    currentAudioPlayer.querySelector(".voice-play-btn").classList.remove("playing");
    const oldAudio = currentAudioPlayer.querySelector(".hidden-audio");
    if (oldAudio) {
      oldAudio.pause();
      oldAudio.remove();
    }
  }

  let audio = voicePlayer.querySelector(".hidden-audio");
  const btn = button;

  if (!audio) {
    audio = new Audio(src);
    audio.classList.add("hidden-audio");
    voicePlayer.appendChild(audio);

    audio.addEventListener("loadedmetadata", () => {
      const duration = Math.floor(audio.duration);
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      voicePlayer.querySelector(".voice-duration").textContent =
        `${minutes}:${seconds.toString().padStart(2, "0")}`;
    });

    audio.addEventListener("timeupdate", () => {
      const current = Math.floor(audio.currentTime);
      const duration = Math.floor(audio.duration);
      const currentMin = Math.floor(current / 60);
      const currentSec = current % 60;
      voicePlayer.querySelector(".voice-duration").textContent =
        `${currentMin}:${currentSec.toString().padStart(2, "0")} / ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, "0")}`;
    });

    audio.addEventListener("ended", () => {
      btn.textContent = "▶";
      btn.classList.remove("playing");
      currentAudioPlayer = null;
    });
  }

  if (audio.paused) {
    audio.play();
    btn.textContent = "⏸";
    btn.classList.add("playing");
    currentAudioPlayer = voicePlayer;
  } else {
    audio.pause();
    btn.textContent = "▶";
    btn.classList.remove("playing");
    currentAudioPlayer = null;
  }
}

// ================ Window Resize Handler ================
window.addEventListener("resize", () => {
  const chatArea = document.querySelector(".chat-area");
  const sidebar = document.querySelector(".sidebar");
  const backBtn = document.getElementById("mobile-back-btn");

  if (window.innerWidth >= 768) {
    if (chatArea) chatArea.classList.remove("active");
    if (sidebar) sidebar.classList.remove("hidden");
    if (backBtn) backBtn.style.display = "none";
  } else {
    if (!currentChatId) {
      if (chatArea) chatArea.classList.remove("active");
      if (sidebar) sidebar.classList.remove("hidden");
      if (backBtn) backBtn.style.display = "none"
    }
  }
});

// ================ Initialize on Page Load ================
window.addEventListener("load", () => {
  initializeApp();
});
