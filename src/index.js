require('dotenv').config();
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// =====================
// WhatsApp Auth Setup
// =====================
async function initWhatsAppSocket() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    mobile: { version: [2, 3000, 101] } // ✅ mobile mode needed for pairing codes
  });

  sock.ev.on('creds.update', saveCreds);
  return sock;
}

// =====================
// Telegram Bot Section
// =====================
const tgBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

tgBot.onText(/\/pair (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const phoneNumber = match[1];

  tgBot.sendMessage(chatId, `⏳ Generating pairing code for *${phoneNumber}*...`, { parse_mode: "Markdown" });

  try {
    const waSock = await initWhatsAppSocket();
    const code = await waSock.requestPairingCode(phoneNumber);

    console.log("✅ Pairing code generated:", code);
    tgBot.sendMessage(chatId, `📌 Your WhatsApp Pairing Code: *${code}*`, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("❌ Pairing error details:", err);
    tgBot.sendMessage(chatId, "❌ Failed to generate pairing code.\n\nError: " + err.message);
  }
});

// =====================
// Default Telegram Reply
// =====================
tgBot.on('message', (msg) => {
  if (!msg.text.startsWith('/pair')) {
    tgBot.sendMessage(msg.chat.id, `Hello ${msg.from.first_name}, use:\n\n/pair <YourNumber>\n\nExample:\n/pair 2348012345678`);
  }
});

console.log("✅ Telegram bot is running!");

// =====================
// Express Web Server (Render)
// =====================
const app = express();

app.get('/', (req, res) => {
  res.send('✅ SIANO-MD (WhatsApp + Telegram Bot) is running on Render!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌍 Web server running on port ${PORT}`);
});
