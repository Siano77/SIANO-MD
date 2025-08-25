require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// =====================
// WhatsApp Bot Section
// =====================
async function startWhatsAppBot(sendToTelegram) {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,     // no console QR
    mobile: {                    // enable mobile mode for pairing codes
      version: [2, 3000, 101],   // recommended WA version
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection } = update;
    if (connection === 'open') {
      sendToTelegram("✅ WhatsApp bot is connected successfully!");
    } else if (connection === 'close') {
      sendToTelegram("⚠️ WhatsApp bot disconnected. Retrying...");
      startWhatsAppBot(sendToTelegram);
    }
  });

  return sock;
}

// =====================
// Telegram Bot Section
// =====================
const tgBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

let waSock = null;

// Command handler
tgBot.onText(/\/pair (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const phoneNumber = match[1].trim();

  if (!/^\d+$/.test(phoneNumber)) {
    return tgBot.sendMessage(chatId, "❌ Please provide a valid WhatsApp number with country code.\nExample: `/pair 2348012345678`", { parse_mode: "Markdown" });
  }

  tgBot.sendMessage(chatId, `⏳ Generating pairing code for *${phoneNumber}*...`, { parse_mode: "Markdown" });

  try {
    if (!waSock) {
      waSock = await startWhatsAppBot((text) => tgBot.sendMessage(chatId, text));
    }

    const code = await waSock.requestPairingCode(phoneNumber);
    tgBot.sendMessage(chatId, `📌 Your WhatsApp Pairing Code for *${phoneNumber}*:\n\n\`${code}\`\n\n➡️ Enter this code in WhatsApp: *Linked Devices → Link with phone number*`, { parse_mode: "Markdown" });
  } catch (err) {
    console.error("Error generating pairing code:", err);
    tgBot.sendMessage(chatId, "❌ Failed to generate pairing code. Please try again.");
  }
});

tgBot.on('message', (msg) => {
  if (!msg.text.startsWith("/pair")) {
    tgBot.sendMessage(msg.chat.id, `Hello ${msg.from.first_name}, your Telegram bot is live 🚀\n\nUse /pair <your_number> to link WhatsApp.`);
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
