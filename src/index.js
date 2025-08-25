require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, delay } = require('@whiskeysockets/baileys');
const pino = require('pino');
const TelegramBot = require('node-telegram-bot-api');
const QRCode = require('qrcode');
const express = require('express');
const fs = require('fs');
const path = require('path');

// =====================
// Environment Variables
// =====================
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OWNER_TELEGRAM_ID = process.env.OWNER_TELEGRAM_ID;
const PREFIX = process.env.PREFIX || '#';
const AUTHORIZED_USERS = (process.env.AUTHORIZED_USERS || '').split(',');

if (!AUTHORIZED_USERS.includes(OWNER_TELEGRAM_ID)) AUTHORIZED_USERS.push(OWNER_TELEGRAM_ID);

// =====================
// Initialize Telegram Bot
// =====================
const tgBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// =====================
// Helper: WhatsApp session path per Telegram user
// =====================
const getSessionPath = (telegramId) => path.join(__dirname, 'sessions', `wa_${telegramId}`);

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

    // Listen for connection updates
    sock.ev.on('connection.update', async (update) => {
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
            const qrImage = await QRCode.toDataURL(qr);
            const base64Data = qrImage.replace(/^data:image\/png;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');

            tgBot.sendPhoto(telegramId, buffer, {
                caption: `📲 WhatsApp QR code for ${phoneNumber}. Scan in WhatsApp > Linked Devices (valid for 60s)`
            });
        }

        if (connection === 'open') {
            tgBot.sendMessage(telegramId, `✅ WhatsApp Bot connected successfully for ${phoneNumber}!`);
        }

        if (connection === 'close') {
            tgBot.sendMessage(telegramId, `⚠️ WhatsApp Bot disconnected for ${phoneNumber}. Attempting to reconnect...`);
            await delay(5000);
            startWhatsAppBot(telegramId, phoneNumber);
        }
    });

    // =====================
    // Listen and respond to WhatsApp messages
    // =====================
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        let text = msg.message.conversation || msg.message.extendedTextMessage?.text;
        if (!text) return;

        const sender = msg.key.remoteJid;

        // Commands with prefix
        if (text.startsWith(PREFIX)) {
            const commandBody = text.slice(PREFIX.length).trim();
            const [command, ...args] = commandBody.split(' ');

            switch (command.toLowerCase()) {
                case 'ping':
                    await sock.sendMessage(sender, { text: 'Pong!' });
                    break;

                case 'help':
                    await sock.sendMessage(sender, { text: `Available commands:\n#ping - Check bot\n#help - Command list` });
                    break;

                default:
                    await sock.sendMessage(sender, { text: `Unknown command: ${command}\nUse #help to see commands.` });
            }
        } else {
            // Generic reply
            await sock.sendMessage(sender, { text: `Hello! Use ${PREFIX}help to see commands.` });
        }
    });

    return sock;
}

// =====================
// Telegram Commands
// =====================
tgBot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    tgBot.sendMessage(chatId, `Hello ${msg.from.first_name}!\nUse /pair to link your WhatsApp number.`);
});

tgBot.onText(/\/pair/, async (msg) => {
    const chatId = msg.chat.id;

    if (!AUTHORIZED_USERS.includes(chatId.toString())) {
        return tgBot.sendMessage(chatId, '❌ You are not authorized to pair the bot.');
    }

    tgBot.sendMessage(chatId, '📌 Reply with your WhatsApp number (with country code, e.g., 2348012345678):');

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

// Generic message reply for unauthorized messages
tgBot.on('message', (msg) => {
    if (msg.text && !msg.text.startsWith('/pair') && !msg.text.startsWith('/start')) {
        tgBot.sendMessage(msg.chat.id, `Hello ${msg.from.first_name}, use /pair to link your WhatsApp.`);
    }
});

// =====================
// Express Web Server (Render)
const app = express();
app.get('/', (req, res) => res.send('✅ SIANO-MD WhatsApp + Telegram Bot running on Render!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌍 Web server running on port ${PORT}`));
