require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");

const app = express();

app.use(helmet());
app.use(express.json({ limit: "200kb" }));

// CORS: allow your frontend origins
const allowed = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);


app.use("/api/contact", rateLimit({ windowMs: 60 * 1000, max: 5 }));

app.get("/api/health", (req, res) => res.json({ ok: true }));

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT || 587),
  secure: process.env.MAIL_SECURE === "true",
  auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
});

const isEmail = (s = "") => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const clamp = (s = "", n = 1000) => String(s).slice(0, n);

app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body || {};
    if (!name || !email || !message)
      return res
        .status(400)
        .json({ error: "name, email, and message are required." });
    if (!isEmail(email))
      return res.status(400).json({ error: "Invalid email address." });

    const cleanName = clamp(name, 100);
    const cleanEmail = clamp(email, 200);
    const cleanMsg = clamp(message, 5000);

    const info = await transporter.sendMail({
      from: `"Portfolio Contact" <${process.env.MAIL_USER}>`,
      to: process.env.MAIL_TO,
      subject: `New contact from ${cleanName}`,
      replyTo: cleanEmail,
      text: `Name: ${cleanName}\nEmail: ${cleanEmail}\n\nMessage:\n${cleanMsg}`,
      html: `<h2>New Contact Message</h2>
             <p><b>Name:</b> ${cleanName}</p>
             <p><b>Email:</b> ${cleanEmail}</p>
             <p><b>Message:</b><br/>${cleanMsg.replace(/\n/g, "<br/>")}</p>`,
    });

    res.json({ ok: true, messageId: info.messageId });
  } catch (err) {
    console.error("Email send failed:", err?.response?.data || err);
    res.status(500).json({ error: "Failed to send message." });
  }
});

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`✅ Contact backend listening on http://localhost:${PORT}`);
});

server.on("error", (err) => console.error("❌ Server error:", err));
