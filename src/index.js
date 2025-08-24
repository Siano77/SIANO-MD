require('dotenv').config();
const pino = require('pino');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require('@whiskeysockets/baileys');

const handleMessage = require('./handler');
const { getGroupSettings, ensureStore } = require('./utils/store');
const { handleAntiLinkOnMessage } = require('./utils/moderation');

const logger = pino({ level: 'info' });

async function start() {
    ensureStore();
    const { state, saveCreds } = await useMultiFileAuthState('session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger,
        auth: state,
        printQRInTerminal: false,
        browser: ['SIANO-MD', 'Chrome', '100.0.0'] // Bot name added here
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            logger.info({lastDisconnect, reconnecting: shouldReconnect}, 'Connection closed, reconnecting...');
            if (shouldReconnect) {
                start();
            } else {
                logger.warn('Logged out. Please re-authenticate.');
            }
        } else if (connection === 'open') {
            logger.info('Connection opened!');
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m || !m.message) return;

        try {
            await handleAntiLinkOnMessage(sock, m);
        } catch (e) {
            logger.warn({ e }, 'Anti-link check failed');
        }

        try {
            await handleMessage(sock, m);
        } catch (e) {
            logger.error({ e }, 'Handler failed');
        }
    });

    sock.ev.on('group-participants.update', async (update) => {
        try {
            const chat = update.id;
            const settings = getGroupSettings(chat);
            if (!settings.welcome || update.action !== 'add') return;
            const user = update.participants[0];
            const text = (settings.welcomeText || 'Welcome to the group, @user 🎉')
                .replace(/@user/g, `@${user.split('@')[0]}`);
            await sock.sendMessage(chat, { text, mentions: [user] });
        } catch (e) {
            logger.warn({ e }, 'Welcome failed');
        }
    });
}

start();
