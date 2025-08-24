require('dotenv').config()
const pino = require('pino')
const { 
  default: makeWASocket, 
  useMultiFileAuthState, 
  fetchLatestBaileysVersion 
} = require('@whiskeysockets/baileys')

const handleMessage = require('./handler')
const { getGroupSettings, ensureStore } = require('./utils/store')
const { handleAntiLinkOnMessage } = require('./utils/moderation')

const logger = pino({ level: 'info' })

async function start() {
  ensureStore()
  const { state, saveCreds } = await useMultiFileAuthState('session')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger,
    auth: state,
    printQRInTerminal: true
  })

  sock.ev.on('creds.update', saveCreds)

  // Main message pipeline
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const m = messages[0]
    if (!m || !m.message) return

    // Anti-link moderation
    try { 
      await handleAntiLinkOnMessage(sock, m) 
    } catch (e) { 
      logger.warn({ e }, 'Anti-link check failed') 
    }

    // Commands handler
    try { 
      await handleMessage(sock, m) 
    } catch (e) { 
      logger.error({ e }, 'Handler failed') 
    }
  })

  // Welcome messages
  sock.ev.on('group-participants.update', async (update) => {
    try {
      const chat = update.id
      const settings = getGroupSettings(chat)
      if (!settings.welcome || update.action !== 'add') return
      const user = update.participants[0]
      const text = (settings.welcomeText || 'Welcome to the group, @user 🎉')
        .replace(/@user/g, `@${user.split('@')[0]}`)
      await sock.sendMessage(chat, { text, mentions: [user] })
    } catch (e) { 
      logger.warn({ e }, 'Welcome failed') 
    }
  })
}

start()
