// src/index.js
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
const AUTHORIZED_USERS = (process.env.AUTHORIZED_USERS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

if (OWNER_TELEGRAM_ID && !AUTHORIZED_USERS.includes(OWNER_TELEGRAM_ID)) {
  AUTHORIZED_USERS.push(OWNER_TELEGRAM_ID);
}

if (!TELEGRAM_BOT_TOKEN) {
  console.error('❌ Missing TELEGRAM_BOT_TOKEN in .env');
  process.exit(1);
}

// =====================
// Telegram Bot (robust polling)
// =====================
const tgBot = new TelegramBot(TELEGRAM_BOT_TOKEN, {
  polling: {
    autoStart: true,
    interval: 1000,         // check frequently
    params: { timeout: 10 } // short long-polling to recover quickly
  }
});

// keep it resilient
tgBot.on('polling_error', err => {
  console.error('⚠️ Telegram polling_error:', err?.message || err);
});
tgBot.on('error', err => {
  console.error('⚠️ Telegram error:', err?.message || err);
});

// Track pairing prompts to avoid duplicates
const activePairing = new Map(); // tgChatId -> true

// Keep 1 WA socket per Telegram user (multi-user mode)
const waSockets = new Map(); // tgChatId -> sock

// Anti-spam state per Telegram user
const connNotifyState = new Map(); // tgChatId -> { lastState, lastAt, lastQR }

// =====================
// Helpers
// =====================
const getSessionPath = (telegramId) =>
  path.join(__dirname, 'sessions', `wa_${telegramId}`);

function plural(n, w1 = 'command', w2 = 'commands') {
  return `${n} ${n === 1 ? w1 : w2}`;
}

// Extract text from any WhatsApp message shape
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
// Command Loader (from src/commands/*.js)
// Each file should export: { name, description, execute(client, msg, args) }
// =====================
function loadCommands() {
  const commandsDir = path.join(__dirname, 'commands');
  const map = new Map();

  if (!fs.existsSync(commandsDir)) {
    // Fallback built-ins if there is no commands dir
    map.set('ping', {
      name: 'ping',
      description: 'Check bot responsiveness',
      execute: async (client, msg) => {
        await client.sendMessage(msg.key.remoteJid, { text: '🏓 Pong!' });
      }
    });
    map.set('help', {
      name: 'help',
      description: 'List available commands',
      execute: async (client, msg) => {
        const list = [...map.values()]
          .map(c => `• ${PREFIX}${c.name} — ${c.description || ''}`.trim())
          .join('\n');
        await client.sendMessage(msg.key.remoteJid, {
          text: `📖 Available commands:\n${list}`
        });
      }
    });
    return map;
  }

  const files = fs
    .readdirSync(commandsDir)
    .filter(f => f.endsWith('.js'));

  for (const file of files) {
    try {
      const mod = require(path.join(commandsDir, file));
      if (!mod?.name || typeof mod.execute !== 'function') {
        console.warn(`⚠️ Skipped invalid command file: ${file}`);
        continue;
      }
      map.set(mod.name.toLowerCase(), {
        name: mod.name.toLowerCase(),
        description: mod.description || '',
        execute: mod.execute
      });
    } catch (e) {
      console.error(`❌ Failed to load command '${file}':`, e.message);
    }
  }

  // Ensure ping & help exist (always)
  if (!map.has('ping')) {
    map.set('ping', {
      name: 'ping',
      description: 'Check bot responsiveness',
      execute: async (client, msg) => {
        await client.sendMessage(msg.key.remoteJid, { text: '🏓 Pong!' });
      }
    });
  }
  if (!map.has('help')) {
    map.set('help', {
      name: 'help',
      description: 'List available commands',
      execute: async (client, msg) => {
        const list = [...map.values()]
          .map(c => `• ${PREFIX}${c.name} — ${c.description || ''}`.trim())
          .join('\n');
        await client.sendMessage(msg.key.remoteJid, {
          text: `📖 Available commands:\n${list}`
        });
      }
    });
  }

  console.log(`✅ Loaded ${plural(map.size)} from /src/commands`);
  return map;
}

let COMMANDS = loadCommands();

// =====================
// Start a WhatsApp session for a Telegram user
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

  waSockets.set(telegramId, sock);
  sock.ev.on('creds.update', saveCreds);

  // Connection updates (with anti-spam)
  sock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update;

    // anti-spam state
    const now = Date.now();
    const state = connNotifyState.get(telegramId) || { lastState: null, lastAt: 0, lastQR: null };

    // Send QR only when it changes
    if (qr && qr !== state.lastQR) {
      try {
        const qrImage = await QRCode.toDataURL(qr);
        const buffer = Buffer.from(qrImage.replace(/^data:image\/png;base64,/, ''), 'base64');
        await tgBot.sendPhoto(telegramId, buffer, {
          caption: `📲 WhatsApp QR for ${phoneNumber}.\nOpen WhatsApp → Linked Devices → Link a device.\n(QR refreshes every ~60s)`
        });
        state.lastQR = qr;
        state.lastAt = now;
        connNotifyState.set(telegramId, state);
      } catch (err) {
        console.error('QR send error:', err);
      }
    }

    // Notify on state changes (no spam within 8s)
    if (connection && connection !== state.lastState) {
      const quiet = now - (state.lastAt || 0) < 8000;
      if (!quiet) {
        if (connection === 'open') {
          tgBot.sendMessage(telegramId, `✅ WhatsApp connected for ${phoneNumber}`);
        } else if (connection === 'close') {
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
          tgBot.sendMessage(
            telegramId,
            `⚠️ WhatsApp disconnected for ${phoneNumber}. ${shouldReconnect ? 'Reconnecting…' : 'Session ended (need to pair again).'}`
          );
          if (shouldReconnect) {
            await delay(4000);
            startWhatsAppBot(telegramId, phoneNumber);
          }
        } else {
          tgBot.sendMessage(telegramId, `ℹ️ Connection state: ${connection}`);
        }
        state.lastAt = now;
      }
      state.lastState = connection;
      connNotifyState.set(telegramId, state);
    }
  });

  // WhatsApp message handler (ONLY #prefix)
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    const msg = messages[0];
    if (!msg?.message || msg.key.fromMe) return;

    const text = extractMessageText(msg);
    if (!text || !text.startsWith(PREFIX)) return;

    const commandBody = text.slice(PREFIX.length).trim();
    const [name, ...args] = commandBody.split(/\s+/);
    const key = (name || '').toLowerCase();

    const cmd = COMMANDS.get(key);
    if (!cmd) {
      await sock.sendMessage(msg.key.remoteJid, {
        text: `❓ Unknown command: ${name}\nType ${PREFIX}help for the list.`
      });
      return;
    }

    try {
      await cmd.execute(sock, msg, args);
    } catch (err) {
      console.error(`❌ Command error [${key}]:`, err);
      await sock.sendMessage(msg.key.remoteJid, {
        text: `⚠️ Error running ${PREFIX}${key}: ${err.message || 'unknown error'}`
      });
    }
  });

  return sock;
}

// =====================
// Telegram Commands
// =====================
tgBot.onText(/\/start\b/i, (msg) => {
  const chatId = msg.chat.id;
  tgBot.sendMessage(
    chatId,
    [
      `Hi ${msg.from.first_name || ''}! 👋`,
      `Use /pair to link your WhatsApp device.`,
      `Authorized users: ${AUTHORIZED_USERS.length ? 'configured' : 'none (only OWNER)'}`
    ].join('\n')
  );
});

tgBot.onText(/\/pair\b/i, async (msg) => {
  const chatId = msg.chat.id.toString();

  if (!AUTHORIZED_USERS.includes(chatId)) {
    return tgBot.sendMessage(msg.chat.id, '❌ You are not authorized to pair the bot.');
  }
  if (activePairing.get(chatId)) {
    return tgBot.sendMessage(msg.chat.id, '⚠️ You already started pairing. Please reply with your phone number or wait.');
  }

  tgBot.sendMessage(
    msg.chat.id,
    '📌 Reply with your WhatsApp number (with country code, e.g., 2348012345678):'
  );

  const numberListener = async (replyMsg) => {
    if (replyMsg.chat.id.toString() !== chatId) return;

    const phoneNumber = (replyMsg.text || '').replace(/\D/g, '');
    tgBot.removeListener('message', numberListener);
    activePairing.delete(chatId);

    if (!phoneNumber) {
      return tgBot.sendMessage(replyMsg.chat.id, '❌ Invalid number. Please run /pair again.');
    }

    try {
      await startWhatsAppBot(chatId, phoneNumber);
      tgBot.sendMessage(
        replyMsg.chat.id,
        `✅ Pairing started for ${phoneNumber}. A QR code will be sent shortly.`
      );
    } catch (err) {
      console.error('Pairing error:', err);
      tgBot.sendMessage(
        replyMsg.chat.id,
        `❌ Failed to start WhatsApp session: ${err.message}`
      );
    }
  };

  tgBot.on('message', numberListener);
  activePairing.set(chatId, true);
});

// Optional: command to reload commands without restarting
tgBot.onText(/\/reload\b/i, (msg) => {
  const chatId = msg.chat.id.toString();
  if (chatId !== OWNER_TELEGRAM_ID) {
    return tgBot.sendMessage(msg.chat.id, '❌ Only owner can reload commands.');
  }

  // clear require cache for commands
  const commandsDir = path.join(__dirname, 'commands');
  if (fs.existsSync(commandsDir)) {
    for (const key of Object.keys(require.cache)) {
      if (key.startsWith(commandsDir)) delete require.cache[key];
    }
  }
  COMMANDS = loadCommands();
  tgBot.sendMessage(msg.chat.id, `🔄 Reloaded ${plural(COMMANDS.size)}.`);
});

// Generic response (don’t spam; only when not /pair or /start)
tgBot.on('message', (msg) => {
  const text = msg.text || '';
  if (!text.startsWith('/pair') && !text.startsWith('/start') && !text.startsWith('/reload')) {
    // Keep it quiet: only respond if user types something to the bot directly
    if (msg.chat?.type === 'private') {
      tgBot.sendMessage(msg.chat.id, `Hi ${msg.from.first_name || ''}! Use /pair to link your WhatsApp.`);
    }
  }
});

// =====================
// Express Web Server (Render keep-alive)
// =====================
const app = express();
app.get('/', (_req, res) => {
  res.send('✅ SIANO-MD (WhatsApp + Telegram) is running and healthy!');
});

// Use port 4000 by default (or Render’s PORT)
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🌍 Web server running on port ${PORT}`);
  console.log(`🔧 Prefix set to '${PREFIX}' — bot will only respond to ${PREFIX}<command>`);
});
