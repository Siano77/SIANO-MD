require('dotenv').config();
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, fetchLatestBaileysVersion, downloadMediaMessage } = require('@whiskeysockets/baileys');
const pino = require('pino');
const TelegramBot = require('node-telegram-bot-api');
const QRCode = require('qrcode');
const express = require('express');
const fs = require('fs');

// =====================
// Env variables
// =====================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OWNER_TELEGRAM_ID = process.env.OWNER_TELEGRAM_ID;
const PREFIX = process.env.PREFIX || '#';

// =====================
// Init Telegram Bot
// =====================
const tgBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// =====================
// WhatsApp Bot Section
// =====================
let waSock;
async function startWhatsAppBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const { version } = await fetchLatestBaileysVersion();

  waSock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['SIANO-MD', 'Chrome', '100.0.0']
  });

  waSock.ev.on('creds.update', saveCreds);

  waSock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // Convert QR code to image
      const qrImagePath = './qrcode.png';
      await QRCode.toFile(qrImagePath, qr);

      // Send QR image to Telegram
      tgBot.sendPhoto(
        OWNER_TELEGRAM_ID,
        qrImagePath,
        { caption: '📌 Scan this QR code in WhatsApp → Settings → Linked Devices to pair your number.' }
      );
    }

    if (connection === 'open') {
      tgBot.sendMessage(OWNER_TELEGRAM_ID, '✅ WhatsApp Bot connected successfully!');
    } else if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== 401);
      tgBot.sendMessage(OWNER_TELEGRAM_ID, '⚠️ WhatsApp Bot disconnected. Reconnecting...');
      if (shouldReconnect) startWhatsAppBot();
    }
  });

  // Message handling
  waSock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message || m.key.fromMe) return;

    const from = m.key.remoteJid;
    const text = m.message.conversation || m.message.extendedTextMessage?.text;

    if (text?.startsWith(PREFIX)) {
      const command = text.slice(PREFIX.length).trim().toLowerCase();
      if (command === 'ping') {
        await waSock.sendMessage(from, { text: 'pong 🏓' });
      }
    }
  });
}

startWhatsAppBot();

// =====================
// Telegram Commands
// =====================
tgBot.onText(/\/pair/, (msg) => {
  const chatId = msg.chat.id.toString();
  if (chatId !== OWNER_TELEGRAM_ID) {
    return tgBot.sendMessage(chatId, '❌ You are not authorized to pair this bot.');
  }

  tgBot.sendMessage(chatId, '🔹 WhatsApp QR will be sent shortly. Make sure WhatsApp is open on your phone.');
});

// Generic message
tgBot.on('message', (msg) => {
  if (!msg.text?.startsWith('/pair')) {
    tgBot.sendMessage(msg.chat.id, `Hello ${msg.from.first_name}, your Telegram bot is live! Use /pair to get the WhatsApp QR code.`);
  }
});

// =====================
// Express Web Server (for Render)
// =====================
const app = express();
app.get('/', (req, res) => res.send('✅ SIANO-MD (WhatsApp + Telegram Bot) is running on Render!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌍 Web server running on port ${PORT}`));
