// ================ Admin Dashboard ================

let adminCurrentTab = "users";
let adminAllUsers = [];
let adminSelectedUserId = null;

// Check if user is admin (email = adminview123@gmail.com)
function isAdmin() {
  return currentUserEmail === "adminview123@gmail.com";
}

// Open admin dashboard
function openAdminDashboard() {
  if (!isAdmin()) {
    alert("Access denied - Admin only");
    return;
  }
  
  document.getElementById("chat-page").classList.remove("active");
  document.getElementById("admin-page").classList.add("active");
  
  loadAdminStats();
  loadAdminUsers();
  loadAdminActiveUsers();
  startAdminRealtimeUpdates();
}

// Back to chat from admin
function backToChat() {
  document.getElementById("admin-page").classList.remove("active");
  document.getElementById("chat-page").classList.add("active");
  stopAdminRealtimeUpdates();
}

// Switch admin tabs
function switchAdminTab(tab) {
  adminCurrentTab = tab;
  
  document.querySelectorAll(".admin-tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".admin-tab-content").forEach((c) => c.classList.remove("active"));
  
  event.target.classList.add("active");
  document.getElementById(`admin-${tab}-tab`).classList.add("active");
  
  if (tab === "activity") {
    loadAdminActivity();
  }
}

// Load admin statistics
async function loadAdminStats() {
  try {
    const response = await fetch("/api/admin/stats", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error("Failed to fetch stats");

    const stats = await response.json();

    document.getElementById("stat-total-users").textContent = stats.totalUsers;
    document.getElementById("stat-active-users").textContent = stats.activeUsers;
    document.getElementById("stat-total-groups").textContent = stats.totalGroups;
    document.getElementById("stat-today-messages").textContent = stats.todayMessages;
    document.getElementById("stat-total-messages").textContent = stats.totalMessages;

    console.log("📊 Admin stats loaded:", stats);
  } catch (error) {
    console.error("❌ Error loading admin stats:", error);
  }
}

// Load all users
async function loadAdminUsers() {
  try {
    const response = await fetch("/api/admin/users", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error("Failed to fetch users");

    adminAllUsers = await response.json();
    displayAdminUsers(adminAllUsers);

    console.log("👥 Admin users loaded:", adminAllUsers.length);
  } catch (error) {
    console.error("❌ Error loading admin users:", error);
  }
}

// Display users in admin list
function displayAdminUsers(users) {
  const usersList = document.getElementById("admin-users-list");
  usersList.innerHTML = "";

  users.forEach((user) => {
    const userEl = document.createElement("div");
    userEl.className = "admin-user-item";
    userEl.innerHTML = `
      <div class="admin-user-card">
        <img src="${user.avatar || '/default-avatar.svg'}" alt="${user.username}" class="admin-user-card-avatar" />
        <div class="admin-user-card-info">
          <h4>${user.username}</h4>
          <p>${user.email}</p>
          <span class="status-badge ${user.status}">${user.status}</span>
        </div>
        <div class="admin-user-card-stats">
          <span>📧 ${user.messageCount} messages</span>
          <span>👥 ${user.groupCount} groups</span>
        </div>
        <button class="btn-primary" onclick="openAdminUserDetails(${user.id})">View</button>
      </div>
    `;
    usersList.appendChild(userEl);
  });
}

// Load active users
async function loadAdminActiveUsers() {
  try {
    const response = await fetch("/api/admin/active-users", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error("Failed to fetch active users");

    const activeUsers = await response.json();
    displayAdminActiveUsers(activeUsers);
  } catch (error) {
    console.error("❌ Error loading active users:", error);
  }
}

// Display active users
function displayAdminActiveUsers(users) {
  const usersList = document.getElementById("admin-active-users-list");
  usersList.innerHTML = "";

  if (users.length === 0) {
    usersList.innerHTML = "<p>No active users</p>";
    return;
  }

  users.forEach((user) => {
    const userEl = document.createElement("div");
    userEl.className = "admin-user-item";
    userEl.innerHTML = `
      <div class="admin-user-card">
        <img src="${user.avatar || '/default-avatar.svg'}" alt="${user.username}" class="admin-user-card-avatar" />
        <div class="admin-user-card-info">
          <h4>${user.username}</h4>
          <span class="status-badge online">🟢 Online</span>
        </div>
        <button class="btn-primary" onclick="openAdminUserDetails(${user.id})">View</button>
      </div>
    `;
    usersList.appendChild(userEl);
  });
}

// Load user activity
async function loadAdminActivity() {
  try {
    // Load recent activities for first user as example
    if (adminAllUsers.length > 0) {
      const response = await fetch(`/api/admin/user-activity/${adminAllUsers[0].id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to fetch activity");

      const data = await response.json();
      displayAdminActivity(data.activity);
    }
  } catch (error) {
    console.error("❌ Error loading activity:", error);
  }
}

// Display activity
function displayAdminActivity(activities) {
  const activityList = document.getElementById("admin-activity-list");
  activityList.innerHTML = "";

  activities.forEach((activity) => {
    const actEl = document.createElement("div");
    actEl.className = "admin-activity-item";
    actEl.innerHTML = `
      <div class="admin-activity-card">
        <p><strong>${activity.category.toUpperCase()}</strong></p>
        <p>${activity.message?.substring(0, 50) || "(No message text)"}</p>
        <span class="time-badge">${new Date(activity.created_at).toLocaleString()}</span>
      </div>
    `;
    activityList.appendChild(actEl);
  });
}

// Open user details modal
async function openAdminUserDetails(userId) {
  adminSelectedUserId = userId;
  
  try {
    const response = await fetch(`/api/admin/user-activity/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error("Failed to fetch user details");

    const data = await response.json();
    const user = data.user;
    const activity = data.activity;

    // Find user in all users list for stats
    const userStats = adminAllUsers.find((u) => u.id === userId);

    // Populate modal
    document.getElementById("admin-user-avatar").src = user.avatar || "/default-avatar.svg";
    document.getElementById("admin-user-username").textContent = user.username;
    document.getElementById("admin-user-email").textContent = user.email;
    document.getElementById("admin-user-status").textContent = user.status;
    document.getElementById("admin-user-joined").textContent = new Date(user.created_at).toLocaleDateString();
    document.getElementById("admin-user-messages").textContent = userStats?.messageCount || 0;
    document.getElementById("admin-user-groups").textContent = userStats?.groupCount || 0;

    // Display recent activity
    const activityDiv = document.getElementById("admin-user-activity");
    activityDiv.innerHTML = "";
    activity.slice(0, 10).forEach((act) => {
      const actEl = document.createElement("div");
      actEl.className = "admin-activity-item-small";
      actEl.innerHTML = `
        <p>${act.message?.substring(0, 100) || "(Voice/Media)"}</p>
        <span>${new Date(act.created_at).toLocaleString()}</span>
      `;
      activityDiv.appendChild(actEl);
    });

    document.getElementById("admin-user-modal").classList.add("active");
  } catch (error) {
    console.error("❌ Error loading user details:", error);
  }
}

// Close user details modal
function closeAdminUserModal() {
  document.getElementById("admin-user-modal").classList.remove("active");
  adminSelectedUserId = null;
}

// Delete user
async function deleteAdminUser() {
  if (!adminSelectedUserId) return;

  if (!confirm("Are you sure you want to delete this user?")) return;

  try {
    const response = await fetch(`/api/admin/user/${adminSelectedUserId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error("Failed to delete user");

    alert("User deleted successfully");
    closeAdminUserModal();
    loadAdminUsers();
    loadAdminStats();
  } catch (error) {
    console.error("❌ Error deleting user:", error);
    alert("Error deleting user");
  }
}

// Search admin users
function searchAdminUsers() {
  const query = document.getElementById("admin-search-users").value.toLowerCase();
  const filtered = adminAllUsers.filter(
    (u) =>
      u.username.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query)
  );
  displayAdminUsers(filtered);
}

// Real-time updates
let adminUpdateInterval = null;

function startAdminRealtimeUpdates() {
  adminUpdateInterval = setInterval(() => {
    loadAdminStats();
    loadAdminActiveUsers();
  }, 5000); // Update every 5 seconds
}

function stopAdminRealtimeUpdates() {
  if (adminUpdateInterval) {
    clearInterval(adminUpdateInterval);
  }
}
