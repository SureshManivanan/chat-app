const express = require("express");
const jwt = require("jsonwebtoken");
const { User, OTP } = require("../models/index");
const { sendOTPEmail } = require("../config/emailService");
require("dotenv").config();

const router = express.Router();

// Helper function to generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper function to validate email format
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ENDPOINT 1: Send OTP to email
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email format
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    // Generate 6-digit OTP
    const otpCode = generateOTP();
    const expiryTime = new Date(Date.now() + 120 * 1000); // 120 seconds from now

    // Store OTP in database
    try {
      await OTP.create(email, otpCode, expiryTime);
    } catch (dbError) {
      console.error("Database error:", dbError);
      return res.status(500).json({ error: "Failed to generate verification code" });
    }

    // Send OTP to email
    const emailResult = await sendOTPEmail(email, otpCode);
    if (!emailResult.success) {
      return res.status(500).json({ error: "Failed to send verification code" });
    }

    res.json({ 
      message: "OTP sent successfully to your email",
      expiresIn: 120 
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ENDPOINT 2: Verify OTP and login/register user
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp, username } = req.body;

    // Validate inputs
    if (!email || !otp) {
      return res.status(400).json({ error: "Missing email or OTP" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    // Verify OTP
    const otpRecord = await OTP.findByEmailAndOTP(email, otp);
    if (!otpRecord) {
      return res.status(401).json({ error: "Invalid or expired code" });
    }

    // Check if user exists
    let user = await User.findByEmail(email);

    if (!user) {
      // Create new user if doesn't exist
      if (!username || username.trim() === "") {
        return res.status(400).json({ error: "Username is required for new registration" });
      }

      try {
        const userId = await User.createWithEmail(username, email);
        user = { id: userId, username, email, is_verified: true };
      } catch (createError) {
        console.error("User creation error:", createError);
        return res.status(400).json({ error: "Username already exists or invalid" });
      }
    }

    // Mark user as verified
    await OTP.markUserVerified(email);

    // Delete OTP from database (already used)
    await OTP.deleteOTP(email);

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "7d" }
    );

    res.json({ 
      message: "Login successful",
      token,
      userId: user.id,
      username: user.username,
      email: user.email
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ENDPOINT 3: Check if email is registered (for UI purposes)
router.post("/check-email", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    const user = await User.findByEmail(email);
    res.json({ exists: !!user });
  } catch (error) {
    console.error("Check email error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
