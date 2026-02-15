// Quick email configuration test
// Run with: node test-email-config.js

import dotenv from 'dotenv';
import nodemailer from 'nodemailer';

dotenv.config();

console.log('📧 Email Configuration Test\n');

// Check environment variables
console.log('Environment Variables:');
console.log('  EMAIL_USER:', process.env.EMAIL_USER ? '✅ SET' : '❌ NOT SET');
console.log('  EMAIL_PASS:', process.env.EMAIL_PASS ? '✅ SET' : '❌ NOT SET');
console.log('  EMAIL_TO:', process.env.EMAIL_TO ? '✅ SET' : '❌ NOT SET');
console.log('  EMAIL_HOST:', process.env.EMAIL_HOST || 'smtp.mail.me.com (default)');
console.log('  EMAIL_PORT:', process.env.EMAIL_PORT || '587 (default)');
console.log('  EMAIL_FROM:', process.env.EMAIL_FROM || `"Louis Perrin Tutor" <${process.env.EMAIL_USER || 'not set'}>`);
console.log('');

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.log('❌ Email configuration incomplete!');
  console.log('Please set EMAIL_USER and EMAIL_PASS in your .env file.');
  process.exit(1);
}

// Test SMTP connection
console.log('Testing SMTP connection...');
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.mail.me.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_PORT === '465',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.log('❌ SMTP connection failed!');
    console.log('Error:', error.message);
    console.log('Error code:', error.code);
    console.log('\nCommon fixes:');
    console.log('1. Check EMAIL_USER and EMAIL_PASS are correct');
    console.log('2. For iCloud: Use app-specific password (not your regular password)');
    console.log('3. For Gmail: Enable 2FA and create app password');
    console.log('4. Check EMAIL_HOST and EMAIL_PORT are correct for your provider');
    process.exit(1);
  } else {
    console.log('✅ SMTP connection successful!');
    console.log('\nEmail configuration looks good.');
    console.log('If password reset emails still don\'t work, check:');
    console.log('1. Server logs when requesting password reset');
    console.log('2. Spam/junk folder');
    console.log('3. Email provider filters');
  }
});
