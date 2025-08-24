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
    // Ensure persistent storage folders exist
    ensureStore();

    // Load session credentials
    const { state, saveCreds } = await useMultiFileAuthState('session');

    // Fetch latest WhatsApp Web version
    const { version } = await fetchLatestBaileysVersion();

    // Initialize socket
    const sock = makeWASocket({
        version,
        logger,
        auth: state,
        printQRInTerminal: false, // headless deploy
        browser: ['SIANO-MD', 'Chrome', '100.0.0'] // Bot name appears here
    });

    sock.ev.on('creds.update', saveCreds);

    // Reconnection & connection updates
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            logger.info({ lastDisconnect, reconnecting: shouldReconnect }, 'Connection closed');
            if (shouldReconnect) {
                start(); // Auto reconnect
            } else {
                logger.warn('Logged out. Please re-authenticate.');
            }
        } else if (connection === 'open') {
            logger.info('✅ Connection opened successfully!');
        }
    });

    // Main message pipeline
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const m = messages[0];
        if (!m || !m.message) return;

        try {
            await handleAntiLinkOnMessage(sock, m); // Anti-link moderation
        } catch (e) {
            logger.warn({ e }, 'Anti-link check failed');
        }

        try {
            await handleMessage(sock, m); // Command handler
        } catch (e) {
            logger.error({ e }, 'Handler failed');
        }
    });

    // Welcome messages for new group participants
    sock.ev.on('group-participants.update', async (update) => {
        try {
            const chat = update.id;
            const settings = getGroupSettings(chat);
            if (!settings.welcome || update.action !== 'add') return;

            const user = update.participants[0];
            const welcomeText = settings.welcomeText || 'Welcome to the group, @user 🎉';
            const text = welcomeText.replace(/@user/g, `@${user.split('@')[0]}`);

            await sock.sendMessage(chat, { text, mentions: [user] });
        } catch (e) {
            logger.warn({ e }, 'Welcome message failed');
        }
    });
}

// Start bot
start();
