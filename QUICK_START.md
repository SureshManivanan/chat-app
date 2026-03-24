# 🚀 Quick Start Guide - OTP Email Verification

## 5-Minute Setup

### Step 1: Get Gmail App Password (2 minutes)
1. Go to https://myaccount.google.com/apppasswords
2. Select "Mail" and your device
3. Copy the 16-character password (example: `abcd efgh ijkl mnop`)

### Step 2: Update .env File (1 minute)
Edit `.env` and update:
```env
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
```

### Step 3: Install & Run (2 minutes)
```bash
npm install
npm start
```

### Step 4: Test Login
1. Go to http://localhost:3000
2. Enter your email → Click "Send OTP"
3. Check your email for 6-digit code
4. Enter code → Click "Verify"
5. ✅ You're logged in!

---

## What's Different?

| Before | Now |
|--------|-----|
| ❌ Password-based login | ✅ OTP-based email verification |
| ❌ Password stored in DB | ✅ OTP sent to real email |
| ❌ Password hashing | ✅ Nodemailer Gmail SMTP |
| ❌ Username + Password | ✅ Email + 6-digit OTP |

---

## Key Features

- **Email Verification:** OTP sent to your actual Gmail inbox
- **120-Second Timer:** Countdown shows when OTP expires
- **Auto User Creation:** New users are registered automatically
- **Resend OTP:** Click to get a new code if needed
- **Error Handling:** Clear messages for invalid/expired codes

---

## File Changes Summary

### New Files:
- `config/emailService.js` - Email sending with Nodemailer
- `OTP_SETUP_GUIDE.md` - Detailed setup instructions

### Modified Files:
- `routes/auth.js` - OTP endpoints (send-otp, verify-otp)
- `models/index.js` - Added OTP model functions
- `config/schema.js` - Added email_verification table
- `public/index.html` - OTP UI (2-step form)
- `public/app.js` - OTP logic & countdown timer
- `public/style.css` - OTP styling
- `package.json` - Added nodemailer dependency
- `.env` - Added GMAIL_USER and GMAIL_APP_PASSWORD

### Removed:
- Password fields from database
- Password validation logic
- bcryptjs dependency (no longer needed)

---

## Endpoints

```bash
# Send OTP to email
POST /api/auth/send-otp
Body: { "email": "user@gmail.com" }

# Verify OTP and login/register
POST /api/auth/verify-otp
Body: { "email": "user@gmail.com", "otp": "123456", "username": "optional_for_register" }

# Check if email is registered
POST /api/auth/check-email
Body: { "email": "user@gmail.com" }
```

---

## Troubleshooting

**OTP not arriving?**
- Check spam folder
- Verify email address is correct
- Check GMAIL_USER in .env matches sender

**"Failed to send verification code"?**
- Verify GMAIL_APP_PASSWORD is correct (16 chars, no spaces)
- Verify GMAIL_USER is correct
- Check Gmail 2FA is enabled

**"Invalid or expired code"?**
- Code must be within 120 seconds
- Copy without extra spaces
- Each new request invalidates old OTPs

---

## What Stays the Same?

- ✅ All chat features work identically
- ✅ Socket.io real-time messaging
- ✅ Group chats, private messages, file uploads
- ✅ User profiles and status indicators
- ✅ Admin dashboard

---

**Need More Details?** See `OTP_SETUP_GUIDE.md` for complete documentation.
