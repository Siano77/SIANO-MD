require('dotenv').config();
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, generatePairingCode } = require('@whiskeysockets/baileys');
const pino = require('pino');
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

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

  waSock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['SIANO-MD', 'Chrome', '100.0.0']
  });

  waSock.ev.on('creds.update', saveCreds);

  waSock.ev.on('connection.update', (update) => {
    const { connection } = update;

    if (connection === 'open') {
      tgBot.sendMessage(OWNER_TELEGRAM_ID, '✅ WhatsApp Bot connected successfully!');
    } else if (connection === 'close') {
      tgBot.sendMessage(OWNER_TELEGRAM_ID, '⚠️ WhatsApp Bot disconnected. Reconnecting...');
      startWhatsAppBot();
    }
  });
}

startWhatsAppBot();

// =====================
// Telegram Pair Command
// =====================
tgBot.onText(/\/pair/, async (msg) => {
  const chatId = msg.chat.id;
  if (chatId.toString() !== OWNER_TELEGRAM_ID) {
    return tgBot.sendMessage(chatId, '❌ You are not authorized to pair the bot.');
  }

  tgBot.sendMessage(chatId, '📌 Please reply with the WhatsApp number you want to link (with country code, e.g., 2348012345678):');

  const numberListener = async (replyMsg) => {
    if (replyMsg.chat.id !== chatId) return;

    const phoneNumber = replyMsg.text.replace(/\D/g, ''); // remove non-numeric
    tgBot.removeListener('message', numberListener);

    try {
      const pairingCode = await generatePairingCode(waSock, phoneNumber);
      tgBot.sendMessage(chatId, `✅ WhatsApp pairing code for ${phoneNumber}: \`${pairingCode}\`\n\nScan it in WhatsApp Settings > Linked Devices`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Pairing error:', err);
      tgBot.sendMessage(chatId, `❌ Failed to generate pairing code: ${err.message}`);
    }
  };

  tgBot.on('message', numberListener);
});

// =====================
// Telegram Generic Message
// =====================
tgBot.on('message', (msg) => {
  if (msg.text && !msg.text.startsWith('/pair')) {
    tgBot.sendMessage(msg.chat.id, `Hello ${msg.from.first_name}, your Telegram bot is live! Use /pair to link WhatsApp.`);
  }
});

// =====================
// Express Web Server (Render)
const app = express();
app.get('/', (req, res) => res.send('✅ SIANO-MD (WhatsApp + Telegram Bot) is running on Render!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌍 Web server running on port ${PORT}`));
