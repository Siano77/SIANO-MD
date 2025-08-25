require('dotenv').config();
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const TelegramBot = require('node-telegram-bot-api');
const pino = require('pino');

(async () => {
  // WhatsApp Section
  const { state, saveCreds } = await useMultiFileAuthState('auth');
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

    if (text && text.startsWith(process.env.PREFIX)) {
      await sock.sendMessage(from, { text: `WhatsApp Bot says: You typed ${text}` });
    }
  });

  // Telegram Section
  const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
  const tgBot = new TelegramBot(telegramToken, { polling: true });

  tgBot.on('message', (msg) => {
    tgBot.sendMessage(msg.chat.id, `Hello ${msg.from.first_name}, Telegram bot is live 🚀`);
  });

  console.log("✅ WhatsApp + Telegram Bot is running...");
})();
