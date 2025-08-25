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
const OWNER_TELEGRAM_ID = process.env.OWNER_TELEGRAM_ID; // add this to your .env

tgBot.on('message', (msg) => {
  tgBot.sendMessage(msg.chat.id, `Hello ${msg.from.first_name}, your Telegram bot is live 🚀`);
});

console.log("✅ Telegram bot is running!");

// =====================
// WhatsApp Bot Section
// =====================
async function startWhatsAppBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false, // 🚫 don’t print in Render logs
    logger: pino({ level: 'silent' })
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      // 📩 Send QR/Pairing code to your Telegram
      tgBot.sendMessage(
        OWNER_TELEGRAM_ID,
        `📌 Your WhatsApp Pairing Code:\n\n\`${qr}\`\n\n⚠️ Scan this within 20 seconds in WhatsApp > Linked Devices.`,
        { parse_mode: "Markdown" }
      );
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp bot is connected!');
      tgBot.sendMessage(OWNER_TELEGRAM_ID, "✅ WhatsApp bot connected successfully!");
    } else if (connection === 'close') {
      console.log('❌ WhatsApp connection closed. Retrying...');
      tgBot.sendMessage(OWNER_TELEGRAM_ID, "⚠️ WhatsApp bot disconnected. Reconnecting...");
      startWhatsAppBot();
    }
  });

  sock.ev.on('messages.upsert', async (msg) => {
    const m = msg.messages[0];
    if (!m.message || m.key.fromMe) return;

    const from = m.key.remoteJid;
    const text = m.message.conversation || m.message.extendedTextMessage?.text;

    if (text?.startsWith(process.env.PREFIX)) {
      const command = text.slice(1).trim().toLowerCase();

      if (command === 'ping') {
        await sock.sendMessage(from, { text: 'pong 🏓' });
      }
    }
  });
}

startWhatsAppBot();

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
