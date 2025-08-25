require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const TelegramBot = require('node-telegram-bot-api');
const QRCode = require('qrcode');
const express = require('express');

// =====================
// Env Variables
// =====================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OWNER_TELEGRAM_ID = process.env.OWNER_TELEGRAM_ID;
const PREFIX = process.env.PREFIX || '#';

// =====================
// Telegram Bot
// =====================
const tgBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
tgBot.on('message', (msg) => {
    if (!msg.text.startsWith('/pair')) {
        tgBot.sendMessage(msg.chat.id, `Hello ${msg.from.first_name}, your Telegram bot is live! Use /pair to get WhatsApp QR code.`);
    }
});

// =====================
// WhatsApp Bot
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
        const { connection, qr } = update;

        if (qr) {
            // Generate QR code image and send via Telegram
            try {
                const qrDataUrl = await QRCode.toDataURL(qr);
                tgBot.sendPhoto(
                    OWNER_TELEGRAM_ID,
                    qrDataUrl,
                    { caption: '📲 Scan this QR code to link WhatsApp (expires quickly!)' }
                );
            } catch (err) {
                console.error('QR Code generation error:', err);
                tgBot.sendMessage(OWNER_TELEGRAM_ID, '❌ Failed to generate WhatsApp QR code.');
            }
        }

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
// Telegram /pair Command
// =====================
tgBot.onText(/\/pair/, (msg) => {
    const chatId = msg.chat.id;
    if (chatId.toString() !== OWNER_TELEGRAM_ID) {
        return tgBot.sendMessage(chatId, '❌ You are not authorized to pair this bot.');
    }

    tgBot.sendMessage(chatId, '📌 Wait for the WhatsApp QR code to be sent shortly...');
});

// =====================
// Express Web Server (Render)
const app = express();
app.get('/', (req, res) => res.send('✅ SIANO-MD (WhatsApp + Telegram Bot) is running on Render!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌍 Web server running on port ${PORT}`));
