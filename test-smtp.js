// Quick test script to verify Office 365 SMTP credentials
// Run with: node test-smtp.js YOUR_EMAIL YOUR_PASSWORD TEST_RECIPIENT
// Example: node test-smtp.js admin@cfmeu.org MyPassword123 troy@example.com

const nodemailer = require('nodemailer');

const args = process.argv.slice(2);
if (args.length < 3) {
  console.log('Usage: node test-smtp.js YOUR_EMAIL YOUR_PASSWORD TEST_RECIPIENT');
  console.log('Example: node test-smtp.js admin@cfmeu.org MyPass123 troy@gmail.com');
  process.exit(1);
}

const [smtpUser, smtpPass, testRecipient] = args;

// Your Office 365 SMTP settings
const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false, // false for STARTTLS on port 587
  auth: {
    user: smtpUser,
    pass: smtpPass
  },
  tls: {
    ciphers: 'SSLv3',
    rejectUnauthorized: false
  }
});

// Test the connection
async function testConnection() {
  try {
    console.log('Testing SMTP connection to Office 365...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!');
    
    // Try sending a test email
    console.log('\nSending test email...');
    const info = await transporter.sendMail({
      from: smtpUser, // Must match auth user
      to: testRecipient,
      subject: 'Office 365 SMTP Test',
      text: 'If you receive this, your Office 365 SMTP credentials are working correctly!',
      html: '<b>✅ If you receive this, your Office 365 SMTP credentials are working correctly!</b>'
    });
    
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', info.messageId);
    
  } catch (error) {
    console.error('❌ SMTP Error:', error.message);
    console.error('\nFull error:', error);
    
    if (error.message.includes('Invalid login')) {
      console.log('\n🔍 LIKELY ISSUE: Authentication failed');
      console.log('This usually means:');
      console.log('1. Password is incorrect');
      console.log('2. Basic Auth is disabled (most common)');
      console.log('3. Need to use App Password instead');
    }
  }
}

testConnection();

