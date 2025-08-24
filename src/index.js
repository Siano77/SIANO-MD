const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@adiwajshing/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const handler = require('./handler');
const { loadConfig } = require('./utils/config');
const { loadStore, saveStore } = require('./utils/store');

// 📦 Load Config
const config = loadConfig();

// 🗄️ Load auth state
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
  });

  // 📂 Load Commands dynamically
  sock.commands = new Map();
  const commandsPath = path.join(__dirname, 'commands');
  fs.readdirSync(commandsPath).forEach(file => {
    const command = require(path.join(commandsPath, file));
    sock.commands.set(command.name, command);
  });

  // 🎧 Event listeners
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0];
    if (!m.message) return;
    await handler(sock, m, config);
  });

  // 🔐 Save session
  sock.ev.on('creds.update', saveCreds);

  // 📦 Store session for persistence
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        console.log('❌ Logged out. Delete auth_info and restart.');
      } else {
        console.log('🔄 Reconnecting...');
        startBot();
      }
    } else if (connection === 'open') {
      console.log(`✅ ${config.BOT_NAME} is online as ${sock.user.id}`);
    }
  });
}

startBot();
