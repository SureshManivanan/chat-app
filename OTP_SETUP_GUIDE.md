# OTP Email Verification Setup Guide

## Overview
Your Chat App has been fully converted from password-based login to **OTP-based email verification**. Users now:
1. Enter their email address
2. Receive a 6-digit OTP code via email (sent to their Gmail inbox)
3. Enter the OTP to login/register
4. Get a JWT token for authentication

---

## Prerequisites
- Node.js and npm installed
- MySQL server running
- Gmail account (for sending OTP emails)

---

## Step 1: Install Dependencies

```bash
cd "e:\chat-app - Copy"
npm install
```

This will install:
- `nodemailer` - for sending emails
- `email-validator` - for email validation
- All other existing dependencies

---

## Step 2: Generate Gmail App Password

The system uses **Gmail SMTP** to send OTP codes. Follow these steps:

1. Go to your Gmail account: https://myaccount.google.com/
2. Click **Security** in the left sidebar
3. Enable **2-Step Verification** (if not already enabled)
4. After 2FA is enabled, you'll see "App passwords" option
5. Select **Mail** and **Windows Computer** (or your device)
6. Google will generate a 16-character app password (example: `abcd efgh ijkl mnop`)
7. **Copy this password** (without spaces)

---

## Step 3: Configure Environment Variables

Update the `.env` file in your project root:

```env
# Database Configuration
DB_HOST=localhost
DB_PORT=3307
DB_USER=root
DB_PASSWORD=root
DB_NAME=chat_app_db

# JWT Configuration
JWT_SECRET=your_secret_key_change_this_in_production

# Email Configuration (Gmail)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
```

**Important:** Replace:
- `GMAIL_USER` with your Gmail address
- `GMAIL_APP_PASSWORD` with the 16-character password from Step 2

---

## Step 4: Verify Database Tables

The system will automatically create all required tables on startup:
- `users` - stores user info (NO password field)
- `email_verification` - stores OTP codes with expiry
- `private_messages`, `groups`, `group_members`, `group_messages` - for chat

---

## Step 5: Start the Server

```bash
npm start
# or for development with auto-reload:
npm run dev
```

You should see:
```
✅ Database connected successfully!
✅ All tables created/verified
✅ All users reset to offline status
Server running on http://localhost:3000
```

---

## Testing the OTP Flow

### For Login:
1. Open http://localhost:3000
2. Click **Login** tab
3. Enter any valid email address (e.g., test@gmail.com)
4. Click **Send OTP**
5. Check your email inbox - you should receive:
   - **From:** `your-email@gmail.com` (the configured Gmail)
   - **Subject:** 🔐 Your Chat App Verification Code
   - **Body:** 6-digit OTP code
6. Copy the 6-digit code and paste it in the app
7. Click **Verify Code**
8. If valid, you'll be logged in!

### For Registration:
1. Click **Register** tab
2. Enter a **username** and **email**
3. Click **Send OTP**
4. Follow same process as login
5. New account is created automatically!

---

## System Features

### ✅ OTP Features:
- **6-digit random codes** generated automatically
- **120-second expiry** (2 minutes)
- **Live countdown timer** on frontend
- **Resend OTP** functionality
- **No password storage** required

### ✅ Email Validation:
- Basic email format validation (must contain @ and .)
- SMTP verification via Nodemailer

### ✅ Error Handling:
- "Invalid email address" - if email format is wrong
- "Failed to send verification code" - if Nodemailer can't send
- "Invalid or expired code" - if OTP is wrong or expired

### ✅ Security:
- OTP stored in MySQL with expiry timestamp
- Old OTPs are automatically deleted
- JWT tokens for session management
- No password hashes needed

---

## Database Schema

### users table:
```sql
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  avatar LONGBLOB,
  bio VARCHAR(500),
  status VARCHAR(20) DEFAULT 'offline',
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### email_verification table:
```sql
CREATE TABLE email_verification (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  otp_code VARCHAR(10) NOT NULL,
  expiry_time DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## API Endpoints

### 1. Send OTP
**POST** `/api/auth/send-otp`
```json
{
  "email": "user@gmail.com"
}
```
**Response:**
```json
{
  "message": "OTP sent successfully to your email",
  "expiresIn": 120
}
```

### 2. Verify OTP & Login/Register
**POST** `/api/auth/verify-otp`
```json
{
  "email": "user@gmail.com",
  "otp": "123456",
  "username": "john_doe"  // Required only for new users
}
```
**Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGc...",
  "userId": 1,
  "username": "john_doe"
}
```

### 3. Check if Email Exists
**POST** `/api/auth/check-email`
```json
{
  "email": "user@gmail.com"
}
```
**Response:**
```json
{
  "exists": true
}
```

---

## Frontend Features

### Login/Register Flow:
1. **Step 1:** Enter email (and username for registration)
2. **Step 2:** Receive OTP, enter 6-digit code
3. **Timer:** Shows countdown, expires at 0:00
4. **Resend:** Click "Didn't receive OTP? Resend" button
5. **Back:** Go back to email entry if needed

### UI Components:
- Email input field
- OTP input field (6-digit pattern)
- Send OTP button
- Verify Code button
- 120-second countdown timer
- Error messages for validation
- Resend OTP link

---

## Troubleshooting

### "Failed to send verification code"
- **Cause:** Gmail SMTP connection failed
- **Fix:** 
  - Verify `GMAIL_USER` and `GMAIL_APP_PASSWORD` in `.env`
  - Check Gmail App Password was generated correctly (16 characters)
  - Ensure "Less secure app access" is NOT turning off SMTP

### OTP Not Arriving
- Check spam/junk folder
- Verify email address is correct
- Check that `GMAIL_USER` in `.env` matches your Gmail

### "Invalid or expired code"
- Code must be entered within 120 seconds
- Each new OTP request invalidates old OTPs
- Copy code carefully (no spaces or extra characters)

### Connection Refused Error
- Verify MySQL is running on port 3307 (check `.env`)
- Verify database name and credentials
- Run: `mysql -u root -p -h localhost -P 3307`

---

## Security Recommendations

1. **Change JWT_SECRET** in production:
   ```env
   JWT_SECRET=generate-long-random-string-here
   ```

2. **Rate Limiting:** Add rate limiting to prevent OTP spam
3. **HTTPS:** Use HTTPS in production
4. **Database:** Use strong MySQL password
5. **Gmail:** Use a dedicated Gmail account or OAuth2

---

## File Structure

```
chat-app/
├── config/
│   ├── database.js         (MySQL pool)
│   ├── emailService.js     (NEW - Nodemailer setup)
│   └── schema.js           (Database initialization)
├── models/
│   └── index.js            (User, OTP models + others)
├── middleware/
│   └── auth.js             (JWT middleware)
├── routes/
│   ├── auth.js             (UPDATED - OTP endpoints)
│   ├── users.js
│   └── admin.js
├── public/
│   ├── index.html          (UPDATED - OTP UI)
│   ├── app.js              (UPDATED - OTP logic)
│   ├── admin.js
│   └── style.css           (UPDATED - OTP styles)
├── server.js               (Main server)
├── .env                    (UPDATED - Gmail config)
└── package.json            (UPDATED - Nodemailer added)
```

---

## What Changed?

### Removed:
- ❌ Password field in database
- ❌ bcryptjs hashing
- ❌ Password validation logic
- ❌ Register/Login with password endpoints

### Added:
- ✅ Nodemailer email sending
- ✅ OTP generation and verification
- ✅ email_verification table
- ✅ 120-second expiry system
- ✅ Frontend OTP UI with timer
- ✅ `/api/auth/send-otp` endpoint
- ✅ `/api/auth/verify-otp` endpoint

### Unchanged:
- Socket.io chat functionality
- JWT authentication
- MySQL database
- All messaging features

---

## Next Steps

1. Update `GMAIL_USER` and `GMAIL_APP_PASSWORD` in `.env`
2. Run `npm install`
3. Run `npm start`
4. Test the OTP flow
5. All chat features work as before!

For any issues, check the server logs in terminal for detailed error messages.
