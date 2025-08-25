require('dotenv').config();
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// =====================
// Telegram Bot Section
// =====================
const tgBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

tgBot.onText(/^\/start$/, (msg) => {
  tgBot.sendMessage(msg.chat.id, `👋 Hello ${msg.from.first_name}! 
Use /pair <your_whatsapp_number> to get a WhatsApp pairing code.`);
});

// Handle /pair command
tgBot.onText(/^\/pair (\d{6,15})$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const number = match[1];

  tgBot.sendMessage(chatId, `🔄 Generating pairing code for *${number}*...`, { parse_mode: "Markdown" });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(`auth_${number}`);
    const sock = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: ["SIANO-MD", "Chrome", "1.0.0"]
    });

    // Request pairing code
    const code = await sock.requestPairingCode(number);

    tgBot.sendMessage(
      chatId,
      `📌 Pairing code for *${number}*:\n\n\`${code}\`\n\n👉 Open WhatsApp > Linked Devices > Link a Device and enter this code.`,
      { parse_mode: "Markdown" }
    );

    sock.ev.on("creds.update", saveCreds);
  } catch (err) {
    console.error("❌ Error generating pairing code:", err);
    tgBot.sendMessage(chatId, "⚠️ Failed to generate pairing code. Please try again.");
  }
});

console.log("✅ Telegram bot is running!");

// =====================
// Express Web Server (for Render)
// =====================
const app = express();
app.get('/', (req, res) => {
  res.send('✅ SIANO-MD (WhatsApp + Telegram Bot) is running on Render!');
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌍 Web server running on port ${PORT}`);
});
