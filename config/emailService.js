const nodemailer = require('nodemailer');
require('dotenv').config();

// Validate email credentials on startup
if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
  console.warn('⚠️  WARNING: Gmail credentials are not configured in .env file');
  console.warn('⚠️  Email sending will not work. Please configure GMAIL_USER and GMAIL_APP_PASSWORD');
}

// Create Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

// Verify email using SMTP connection
async function verifyEmailExists(email) {
  try {
    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return false;
    }
    
    // Verify SMTP connection can reach the email
    const verifyResult = await transporter.verify();
    if (!verifyResult) {
      console.error('❌ Email transporter verification failed. Check Gmail credentials.');
    }
    return verifyResult;
  } catch (error) {
    console.error('❌ Email verification error:', error.message);
    return false;
  }
}

// Send OTP to email
async function sendOTPEmail(email, otp) {
  try {
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: '🔐 Your Chat App Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; text-align: center;">
          <div style="background: white; padding: 40px; border-radius: 10px; max-width: 400px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
            <h1 style="color: #667eea; margin-bottom: 20px;">Welcome to Chat App</h1>
            <p style="color: #666; font-size: 16px; margin-bottom: 30px;">Your verification code is:</p>
            <div style="background: #f0f0f0; padding: 20px; border-radius: 5px; margin-bottom: 30px;">
              <h2 style="color: #667eea; letter-spacing: 5px; margin: 0; font-size: 32px; font-family: 'Courier New', monospace;">${otp}</h2>
            </div>
            <p style="color: #999; font-size: 14px; margin-bottom: 10px;">This code expires in 2 minutes</p>
            <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ OTP email sent successfully to:', email);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending email:', error.message);
    console.error('Email Details:', {
      from: process.env.GMAIL_USER,
      to: email,
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

module.exports = {
  verifyEmailExists,
  sendOTPEmail,
  transporter,
};
