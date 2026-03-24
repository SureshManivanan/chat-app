# Gmail Setup Instructions for Chat App

## ⚠️ IMPORTANT: Your current email configuration is INVALID

The error you're seeing (`Username and Password not accepted`) means the Gmail credentials in `.env` are not correct.

## How to Fix It:

### Step 1: Enable 2-Factor Authentication on Your Google Account
1. Go to https://myaccount.google.com/
2. Click on "Security" in the left menu
3. Scroll down to "How you sign in to Google"
4. Enable "2-Step Verification" (if not already enabled)

### Step 2: Generate a Gmail App Password
1. Go to https://myaccount.google.com/apppasswords
2. You'll see a dropdown menu asking "Select the app and device you're using"
3. Select:
   - **App:** Mail
   - **Device:** Windows Computer
4. Google will generate a **16-character password** (e.g., `abcd efgh ijkl mnop`)
5. **Copy this entire password** (including spaces if any)

### Step 3: Update Your .env File
1. Open `.env` file in your project
2. Find these lines:
```
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password-here
```
3. Replace:
   - `your-email@gmail.com` with your actual Gmail address (e.g., `myemail@gmail.com`)
   - `your-16-char-app-password-here` with the 16-character password from Step 2

Example (NEVER use this):
```
GMAIL_USER=myemail@gmail.com
GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
```

### Step 4: Restart Your Server
1. Stop the current server (Ctrl+C)
2. Run: `npm start`
3. Check the console for: `✅ OTP email sent successfully`

## Testing the OTP Flow

Once configured correctly:
1. Open http://localhost:3000 in your browser
2. Enter any email address in the login form
3. Click "Send OTP"
4. You should receive an email within 30 seconds
5. Copy the 6-digit code from the email
6. Paste it into the verification form
7. You'll be logged in/registered

## Troubleshooting

**Error: `Failed to send verification code`**
- Check that GMAIL_USER and GMAIL_APP_PASSWORD are correct in `.env`
- Make sure 2-Factor Authentication is enabled
- Verify you're using an App Password (not your regular password)
- App Passwords only work with Gmail accounts (not @workplace.com)

**Error: `Username and Password not accepted`**
- The APP PASSWORD is wrong or outdated
- Generate a new one from https://myaccount.google.com/apppasswords
- Make sure you copied the full 16-character password

**No email received**
- Wait up to 1-2 minutes (sometimes Gmail is slow)
- Check your spam/junk folder
- Check the server console for error messages
