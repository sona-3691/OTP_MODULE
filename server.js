const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const bodyParser = require('body-parser');
const SibApiV3Sdk = require('sib-api-v3-sdk');

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const otpStore = {}; // In-memory OTP storage: { email: { otp, createdAt } }

// Brevo setup
const defaultClient = SibApiV3Sdk.ApiClient.instance;
defaultClient.authentications['api-key'].apiKey = process.env.BREVO_KEY;
const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

// Endpoint to send OTP
app.post('/send-otp', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore[email] = {
    otp,
    createdAt: Date.now()
  };

  try {
    const sender = {
      name: "OTP Verification",
      email: process.env.SENDER_EMAIL
    };

    const receivers = [{ email }];

    await tranEmailApi.sendTransacEmail({
      sender,
      to: receivers,
      subject: "Your OTP Code",
      htmlContent: `<h3>Your OTP is: <b>${otp}</b></h3><p>This OTP will expire in 5 minutes.</p>`,
    });

    res.status(200).json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("Send OTP Error:", err.response?.body || err.message);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

// Endpoint to verify OTP
app.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  const record = otpStore[email];
  if (!record) {
    return res.status(400).json({ message: "OTP not found" });
  }

  const isExpired = (Date.now() - record.createdAt) > 5 * 60 * 1000;
  if (isExpired) {
    delete otpStore[email];
    return res.status(400).json({ message: "OTP expired" });
  }

  if (record.otp !== otp) {
    return res.status(400).json({ message: "Incorrect OTP" });
  }

  delete otpStore[email];
  res.status(200).json({ message: "OTP verified successfully" });
});

// Start the server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});



