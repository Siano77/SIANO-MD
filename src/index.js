require('dotenv').config();
const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    delay
} = require('@whiskeysockets/baileys');
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
const PREFIX = '#'; // Fixed prefix as requested
const AUTHORIZED_USERS = (process.env.AUTHORIZED_USERS || '').split(',');

if (!AUTHORIZED_USERS.includes(OWNER_TELEGRAM_ID)) AUTHORIZED_USERS.push(OWNER_TELEGRAM_ID);

// =====================
// Initialize Telegram Bot
// =====================
const tgBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Track listeners per user to prevent spam
const activePairing = new Map();

// =====================
// Helper: WhatsApp session path per Telegram user
// =====================
const getSessionPath = (telegramId) =>
    path.join(__dirname, 'sessions', `wa_${telegramId}`);

// =====================
// Extract WhatsApp Message Text
// =====================
function extractMessageText(msg) {
    try {
        return (
            msg?.message?.conversation ||
            msg?.message?.extendedTextMessage?.text ||
            msg?.message?.imageMessage?.caption ||
            msg?.message?.videoMessage?.caption ||
            msg?.message?.buttonsResponseMessage?.selectedButtonId ||
            msg?.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
            msg?.message?.documentWithCaptionMessage?.caption ||
            msg?.message?.templateButtonReplyMessage?.selectedId ||
            null
        );
    } catch {
        return null;
    }
}

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

    // =====================
    // Connection Updates
    // =====================
    sock.ev.on('connection.update', async (update) => {
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
            try {
                const qrImage = await QRCode.toDataURL(qr);
                const buffer = Buffer.from(
                    qrImage.replace(/^data:image\/png;base64,/, ''),
                    'base64'
                );
                await tgBot.sendPhoto(telegramId, buffer, {
                    caption: `📲 WhatsApp QR code for ${phoneNumber}. Scan in WhatsApp > Linked Devices`
                });
            } catch (err) {
                console.error('QR send error:', err);
            }
        }

        if (connection === 'open') {
            tgBot.sendMessage(
                telegramId,
                `✅ WhatsApp Bot connected successfully for ${phoneNumber}!`
            );
        }

        if (connection === 'close') {
            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== 401; // Don't loop on invalid sessions
            tgBot.sendMessage(
                telegramId,
                `⚠️ WhatsApp Bot disconnected for ${phoneNumber}. ${
                    shouldReconnect ? 'Reconnecting...' : 'Session ended.'
                }`
            );
            if (shouldReconnect) {
                await delay(5000);
                startWhatsAppBot(telegramId, phoneNumber);
            }
        }
    });

    // =====================
    // WhatsApp Message Listener (Commands only)
    // =====================
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = extractMessageText(msg);
        if (!text || !text.startsWith(PREFIX)) return; // ONLY respond to prefixed commands

        const sender = msg.key.remoteJid;
        const commandBody = text.slice(PREFIX.length).trim();
        const [command, ...args] = commandBody.split(' ');

        switch (command.toLowerCase()) {
            case 'ping':
                await sock.sendMessage(sender, { text: '🏓 Pong!' });
                break;

            case 'help':
                await sock.sendMessage(sender, {
                    text: `📖 Commands:\n${PREFIX}ping - Check bot\n${PREFIX}help - Show this list`
                });
                break;

            default:
                await sock.sendMessage(sender, {
                    text: `❓ Unknown command: ${command}\nUse ${PREFIX}help`
                });
        }
    });

    return sock;
}

// =====================
// Telegram Commands
// =====================
tgBot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    tgBot.sendMessage(
        chatId,
        `Hello ${msg.from.first_name}!\nUse /pair to link your WhatsApp number.`
    );
});

tgBot.onText(/\/pair/, async (msg) => {
    const chatId = msg.chat.id;

    if (!AUTHORIZED_USERS.includes(chatId.toString())) {
        return tgBot.sendMessage(chatId, '❌ You are not authorized to pair the bot.');
    }

    if (activePairing.has(chatId)) {
        return tgBot.sendMessage(chatId, '⚠️ You are already in pairing mode.');
    }

    tgBot.sendMessage(
        chatId,
        '📌 Reply with your WhatsApp number (with country code, e.g., 2348012345678):'
    );

    const numberListener = async (replyMsg) => {
        if (replyMsg.chat.id !== chatId) return;

        const phoneNumber = replyMsg.text.replace(/\D/g, '');
        tgBot.removeListener('message', numberListener);
        activePairing.delete(chatId);

        try {
            await startWhatsAppBot(chatId, phoneNumber);
            tgBot.sendMessage(
                chatId,
                `✅ WhatsApp pairing started for ${phoneNumber}. QR code will be sent shortly.`
            );
        } catch (err) {
            console.error('Pairing error:', err);
            tgBot.sendMessage(
                chatId,
                `❌ Failed to start WhatsApp session: ${err.message}`
            );
        }
    };

    tgBot.on('message', numberListener);
    activePairing.set(chatId, true);
});

// =====================
// Express Web Server (Render)
// =====================
const app = express();
app.get('/', (req, res) =>
    res.send('✅ SIANO-MD WhatsApp + Telegram Bot running on Render!')
);
const PORT = process.env.PORT || 4000; // Updated to 4000
app.listen(PORT, () =>
    console.log(`🌍 Web server running on port ${PORT}`)
);
