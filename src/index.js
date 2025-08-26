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
// Helper: Extract text from any WhatsApp message
// =====================
function extractMessageText(msg) {
    try {
        if (msg.message.conversation) return msg.message.conversation;
        if (msg.message.extendedTextMessage) return msg.message.extendedTextMessage.text;
        if (msg.message.imageMessage?.caption) return msg.message.imageMessage.caption;
        if (msg.message.videoMessage?.caption) return msg.message.videoMessage.caption;
        if (msg.message.buttonsResponseMessage) return msg.message.buttonsResponseMessage.selectedButtonId;
        if (msg.message.listResponseMessage) return msg.message.listResponseMessage.singleSelectReply.selectedRowId;
        return null;
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

    // Connection updates
    sock.ev.on('connection.update', async (update) => {
        const { connection, qr, lastDisconnect } = update;

        if (qr) {
            try {
                const qrImage = await QRCode.toDataURL(qr);
                const base64Data = qrImage.replace(/^data:image\/png;base64,/, '');
                const buffer = Buffer.from(base64Data, 'base64');
                tgBot.sendPhoto(telegramId, buffer, {
                    caption: `📲 Scan this WhatsApp QR for ${phoneNumber}\n(Open WhatsApp > Linked Devices)`
                });
            } catch (err) {
                console.error('QR send error:', err.message);
            }
        }

        if (connection === 'open') {
            tgBot.sendMessage(telegramId, `✅ WhatsApp Bot connected for ${phoneNumber}`);
        }

        if (connection === 'close') {
            tgBot.sendMessage(telegramId, `⚠️ Disconnected for ${phoneNumber}, retrying in 5s...`);
            await delay(5000);
            startWhatsAppBot(telegramId, phoneNumber);
        }
    });

    // =====================
    // WhatsApp Message Handler
    // =====================
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text = extractMessageText(msg);
        if (!text) return;

        const sender = msg.key.remoteJid;

        // Commands with prefix
        if (text.startsWith(PREFIX)) {
            const commandBody = text.slice(PREFIX.length).trim();
            const [command] = commandBody.split(' ');

            switch (command.toLowerCase()) {
                case 'ping':
                    await sock.sendMessage(sender, { text: '🏓 Pong!' });
                    break;

                case 'help':
                    await sock.sendMessage(sender, {
                        text: `📖 Commands:\n${PREFIX}ping - Test bot\n${PREFIX}help - Show this list`
                    });
                    break;

                default:
                    await sock.sendMessage(sender, { text: `❌ Unknown command: ${command}\nType ${PREFIX}help` });
            }
        } else {
            // Generic reply (only once per chat, no spam)
            await sock.sendMessage(sender, { text: `👋 Hello! Type ${PREFIX}help to see commands.` });
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

tgBot.onText(/\/pair/, async (msg) => {
    const chatId = msg.chat.id;

    if (!AUTHORIZED_USERS.includes(chatId.toString())) {
        return tgBot.sendMessage(chatId, '❌ You are not authorized to pair the bot.');
    }

    tgBot.sendMessage(chatId, '📌 Send your WhatsApp number (with country code, e.g., 2348012345678):');

    const numberListener = async (replyMsg) => {
        if (replyMsg.chat.id !== chatId) return;

        const phoneNumber = replyMsg.text.replace(/\D/g, '');
        tgBot.removeListener('message', numberListener);

        try {
            await startWhatsAppBot(chatId, phoneNumber);
            tgBot.sendMessage(chatId, `✅ Pairing started for ${phoneNumber}. QR will arrive shortly.`);
        } catch (err) {
            console.error('Pairing error:', err.message);
            tgBot.sendMessage(chatId, `❌ Failed: ${err.message}`);
        }
    };

    tgBot.on('message', numberListener);
});

// Fallback reply for unauthorized msgs
tgBot.on('message', (msg) => {
    if (msg.text && !msg.text.startsWith('/pair') && !msg.text.startsWith('/start')) {
        tgBot.sendMessage(msg.chat.id, `Hello ${msg.from.first_name}, use /pair to link your WhatsApp.`);
    }
});

// =====================
// Express Web Server (Render)
// =====================
const app = express();
app.get('/', (req, res) => res.send('✅ SIANO-MD WhatsApp + Telegram Bot is running!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌍 Server running on port ${PORT}`));
