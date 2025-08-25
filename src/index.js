require('dotenv').config();
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const TelegramBot = require('node-telegram-bot-api');
const qrcode = require('qrcode');
const express = require('express');

// =====================
// Env variables
// =====================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OWNER_TELEGRAM_ID = process.env.OWNER_TELEGRAM_ID;
const PREFIX = process.env.PREFIX || '#';

// =====================
// Telegram Bot Init
// =====================
const tgBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// =====================
// WhatsApp Bot Section
// =====================
let waSock;
let isPairing = false;

async function startWhatsAppBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    waSock = makeWASocket({
        auth: state,
        version,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        browser: ['SIANO-MD', 'Chrome', '100.0.0']
    });

    waSock.ev.on('creds.update', saveCreds);

    waSock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;

        // --- Handle QR for pairing ---
        if (qr) {
            isPairing = true;
            const qrImage = await qrcode.toDataURL(qr);
            await tgBot.sendPhoto(
                OWNER_TELEGRAM_ID,
                qrImage,
                { caption: '📌 Scan this WhatsApp QR code to pair your device (valid for 60s).' }
            );
            console.log('📌 QR sent to Telegram, waiting for scan...');
            return;
        }

        // --- Connection open ---
        if (connection === 'open') {
            isPairing = false;
            await tgBot.sendMessage(OWNER_TELEGRAM_ID, '✅ WhatsApp Bot connected successfully!');
            console.log('✅ WhatsApp connected');
        }

        // --- Connection closed ---
        if (connection === 'close') {
            if (isPairing) {
                console.log('⚠️ Disconnected during pairing, waiting for QR scan...');
                return; // Do not auto-reconnect during pairing
            }
            console.log('⚠️ WhatsApp Bot disconnected. Reconnecting...');
            tgBot.sendMessage(OWNER_TELEGRAM_ID, '⚠️ WhatsApp Bot disconnected. Reconnecting...');
            startWhatsAppBot();
        }
    });

    // --- Messages handler ---
    waSock.ev.on('messages.upsert', async (msg) => {
        const m = msg.messages[0];
        if (!m?.message || m.key.fromMe) return;

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
// Telegram Pair Command
// =====================
tgBot.onText(/\/pair/, (msg) => {
    if (msg.chat.id.toString() !== OWNER_TELEGRAM_ID) {
        return tgBot.sendMessage(msg.chat.id, '❌ You are not authorized to pair the bot.');
    }
    tgBot.sendMessage(msg.chat.id, '📌 Please scan the WhatsApp QR code sent to you. The code is valid for ~60s.');
});

// =====================
// Telegram Generic Message
// =====================
tgBot.on('message', (msg) => {
    if (!msg.text.startsWith('/pair')) {
        tgBot.sendMessage(msg.chat.id, `Hello ${msg.from.first_name}, your Telegram bot is live! Use /pair to link WhatsApp.`);
    }
});

// =====================
// Express Web Server (Render)
const app = express();
app.get('/', (req, res) => res.send('✅ SIANO-MD (WhatsApp + Telegram Bot) is running on Render!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌍 Web server running on port ${PORT}`));
