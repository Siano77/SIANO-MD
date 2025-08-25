// src/index.js
import TelegramBot from "node-telegram-bot-api";
import makeWASocket, { useMultiFileAuthState } from "@whiskeysockets/baileys";
import qrcode from "qrcode";
import fs from "fs";
import path from "path";

// ================== CONFIG ================== //
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN; // set in Render env vars
const SESSIONS_DIR = path.join(process.cwd(), "sessions");

// Ensure sessions folder exists
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Initialize Telegram bot (polling)
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Store WhatsApp sockets per user
const userSessions = {};

// ================== TELEGRAM COMMANDS ================== //

// /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    `👋 Welcome to *SIANO-MD WhatsApp Bot*!\n\nUse /pair to connect your WhatsApp account.`,
    { parse_mode: "Markdown" }
  );
});

// /pair
bot.onText(/\/pair/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = String(chatId);

  bot.sendMessage(chatId, "📌 Please wait... Generating your WhatsApp QR code.");

  try {
    // Use unique folder for each user
    const userSessionPath = path.join(SESSIONS_DIR, userId);
    const { state, saveCreds } = await useMultiFileAuthState(userSessionPath);

    // Create WhatsApp socket
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      browser: ["SIANO-MD", "Chrome", "1.0.0"],
    });

    // Save session for this user
    userSessions[userId] = sock;

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { qr, connection, lastDisconnect } = update;

      if (qr) {
        const qrImage = await qrcode.toBuffer(qr);
        bot.sendPhoto(chatId, qrImage, {
          caption: "📌 Scan this QR code with your WhatsApp to connect.",
        });
      }

      if (connection === "open") {
        bot.sendMessage(chatId, "✅ WhatsApp Connected Successfully!");
      } else if (connection === "close") {
        bot.sendMessage(
          chatId,
          "⚠️ WhatsApp disconnected. Run /pair again if needed."
        );
      }
    });
  } catch (err) {
    console.error("Error in /pair:", err);
    bot.sendMessage(chatId, "❌ Failed to create WhatsApp session. Try again.");
  }
});

// /status
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = String(chatId);

  if (userSessions[userId]) {
    bot.sendMessage(chatId, "✅ Your WhatsApp session is active.");
  } else {
    bot.sendMessage(chatId, "⚠️ No active WhatsApp session. Use /pair to connect.");
  }
});
