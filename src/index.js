require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const TelegramBot = require('node-telegram-bot-api');
const QRCode = require('qrcode');
const express = require('express');
const fs = require('fs');
const path = require('path');

// =====================
// Env variables
// =====================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OWNER_TELEGRAM_ID = process.env.OWNER_TELEGRAM_ID;
const PREFIX = process.env.PREFIX || '#';
const AUTHORIZED_USERS = (process.env.AUTHORIZED_USERS || '').split(',');

// Add OWNER_TELEGRAM_ID to authorized list if missing
if (!AUTHORIZED_USERS.includes(OWNER_TELEGRAM_ID)) {
    AUTHORIZED_USERS.push(OWNER_TELEGRAM_ID);
}

// =====================
// Init Telegram Bot
// =====================
const tgBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// =====================
// Helper: WhatsApp session path for each Telegram user
// =====================
const getSessionPath = (telegramId) => path.join(__dirname, 'sessions', `wa_${telegramId}`);

// =====================
// Clean old sessions (older than 24 hours)
// =====================
function cleanOldSessions() {
    const sessionsDir = path.join(__dirname, 'sessions');
    if (!fs.existsSync(sessionsDir)) return;

    fs.readdirSync(sessionsDir).forEach((folder) => {
        const folderPath = path.join(sessionsDir, folder);
        const stats = fs.statSync(folderPath);
        const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
        if (ageHours > 24) {
            fs.rmSync(folderPath, { recursive: true, force: true });
            console.log(`🗑️ Deleted old session: ${folder}`);
        }
    });
}

// Run cleanup every hour
setInterval(cleanOldSessions, 1000 * 60 * 60);
cleanOldSessions(); // run once at startup

// =====================
// Start WhatsApp Bot for a Telegram user
// =====================
async function startWhatsAppBot(telegramId, phoneNumber) {
    const sessionPath = getSessionPath(telegramId);

    if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        browser: ['SIANO-MD', 'Chrome', '100.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;

        if (qr) {
            // Send QR code image to Telegram
            const qrImage = await QRCode.toDataURL(qr);
            const base64Data = qrImage.replace(/^data:image\/png;base64,/, "");
            const buffer = Buffer.from(base64Data, 'base64');

            tgBot.sendPhoto(telegramId, buffer, {
                caption: `📲 WhatsApp QR code for ${phoneNumber}. Scan it in WhatsApp > Linked Devices (expires in 20s)`
            });

            // Remove session folder after 20 seconds automatically
            setTimeout(() => {
                if (fs.existsSync(sessionPath)) {
                    fs.rmSync(sessionPath, { recursive: true, force: true });
                    tgBot.sendMessage(telegramId, '⚠️ QR code expired. Session cleaned. You can run /pair again.');
                    console.log(`🗑️ Removed expired session for Telegram ID: ${telegramId}`);
                }
            }, 20000); // 20 seconds
        }

        if (connection === 'open') {
            tgBot.sendMessage(telegramId, `✅ WhatsApp Bot connected successfully for ${phoneNumber}!`);
        }

        if (connection === 'close') {
            tgBot.sendMessage(telegramId, `⚠️ WhatsApp Bot disconnected for ${phoneNumber}. You may run /pair again.`);
        }
    });

    return sock;
}

// =====================
// Telegram Commands
// =====================
tgBot.onText(/\/start/, (msg) => {
    tgBot.sendMessage(msg.chat.id, `Hello ${msg.from.first_name}!\nUse /pair to link your WhatsApp number.`);
});

tgBot.onText(/\/pair/, (msg) => {
    const chatId = msg.chat.id;

    if (!AUTHORIZED_USERS.includes(chatId.toString())) {
        return tgBot.sendMessage(chatId, '❌ You are not authorized to pair the bot.');
    }

    tgBot.sendMessage(chatId, '📌 Please reply with your WhatsApp number (with country code, e.g., 2348012345678):');

    const numberListener = async (replyMsg) => {
        if (replyMsg.chat.id !== chatId) return;
        const phoneNumber = replyMsg.text.replace(/\D/g, '');
        tgBot.removeListener('message', numberListener);

        try {
            await startWhatsAppBot(chatId, phoneNumber);
            tgBot.sendMessage(chatId, `✅ WhatsApp pairing process started for ${phoneNumber}. QR code should arrive shortly.`);
        } catch (err) {
            console.error('Pairing error:', err);
            tgBot.sendMessage(chatId, `❌ Failed to start WhatsApp session: ${err.message}`);
        }
    };

    tgBot.on('message', numberListener);
});

// Generic messages
tgBot.on('message', (msg) => {
    if (msg.text && !msg.text.startsWith('/pair') && !msg.text.startsWith('/start')) {
        tgBot.sendMessage(msg.chat.id, `Hello ${msg.from.first_name}, use /pair to link your WhatsApp.`);
    }
});

// =====================
// Express Web Server (Render)
const app = express();
app.get('/', (req, res) => res.send('✅ SIANO-MD (WhatsApp + Telegram Bot) is running on Render!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌍 Web server running on port ${PORT}`));
