// src/index.js
require('dotenv').config()
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, delay } = require('@whiskeysockets/baileys')
const pino = require('pino')
const TelegramBot = require('node-telegram-bot-api')
const QRCode = require('qrcode')
const express = require('express')
const fs = require('fs')
const path = require('path')
const { ensureStore, getGroupSettings, setGroupSetting } = require('./utils/store')

// env
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const OWNER_TELEGRAM_ID = process.env.OWNER_TELEGRAM_ID
const PREFIX = process.env.PREFIX || '#'
const PORT = process.env.PORT || 4000
const AUTHORIZED_USERS = (process.env.AUTHORIZED_USERS || OWNER_TELEGRAM_ID || '').split(',').map(s => s.trim()).filter(Boolean)

if (!TELEGRAM_BOT_TOKEN) {
  console.error('Missing TELEGRAM_BOT_TOKEN in .env')
  process.exit(1)
}

// ensure data folder exists
ensureStore()

// Telegram bot (polling)
const tgBot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: { autoStart: true, interval: 1500, params: { timeout: 15 } } })
tgBot.on('polling_error', (err) => console.error('Telegram polling error', err?.message || err))

// command loader
function loadCommands() {
  const dir = path.join(__dirname, 'commands')
  const commands = new Map()
  if (!fs.existsSync(dir)) {
    console.warn('Commands folder not found:', dir)
    return commands
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'))
  for (const f of files) {
    try {
      const mod = require(path.join(dir, f))
      if (mod?.name && typeof mod.execute === 'function') {
        commands.set(mod.name.toLowerCase(), mod)
      } else {
        console.warn('Skipped invalid command file:', f)
      }
    } catch (e) {
      console.error('Failed loading command', f, e.message)
    }
  }
  console.log(`Loaded ${commands.size} commands`)
  return commands
}
let COMMANDS = loadCommands()

// helpers
const getSessionPath = (telegramId) => path.join(process.cwd(), 'sessions', `wa_${telegramId}`)
const activePairing = new Map()
const waSockets = new Map() // telegramId -> sock
const connNotifyState = new Map() // telegramId -> { lastState, lastAt, lastQR }

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
      null
    )
  } catch { return null }
}

async function startWhatsAppBot(telegramId, phoneNumber) {
  const sessionPath = getSessionPath(telegramId)
  if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: [process.env.BOT_NAME || 'SIANO-MD', 'Chrome', '1.0']
  })

  waSockets.set(telegramId.toString(), sock)
  sock.ev.on('creds.update', saveCreds)

  // connection updates
  sock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update
    const now = Date.now()
    const st = connNotifyState.get(telegramId) || { lastState: null, lastAt: 0, lastQR: null }

    if (qr && qr !== st.lastQR) {
      try {
        const qrImage = await QRCode.toDataURL(qr)
        const buffer = Buffer.from(qrImage.replace(/^data:image\/png;base64,/, ''), 'base64')
        await tgBot.sendPhoto(telegramId, buffer, { caption: `📲 WhatsApp QR for ${phoneNumber}. Open WhatsApp > Linked Devices > Link a device. (QR valid ~60s)` })
        st.lastQR = qr; st.lastAt = now; connNotifyState.set(telegramId, st)
      } catch (e) {
        console.error('QR send failed', e.message)
      }
    }

    // state notifications, limited frequency
    if (connection && connection !== st.lastState) {
      const quiet = now - (st.lastAt || 0) < 8000
      if (!quiet) {
        if (connection === 'open') {
          await tgBot.sendMessage(telegramId, `✅ WhatsApp connected for ${phoneNumber}`)
        } else if (connection === 'close') {
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401
          await tgBot.sendMessage(telegramId, `⚠️ WhatsApp disconnected for ${phoneNumber}. ${shouldReconnect ? 'Reconnecting...' : 'Session ended.'}`)
          if (shouldReconnect) { await delay(4000); startWhatsAppBot(telegramId, phoneNumber) }
        } else {
          await tgBot.sendMessage(telegramId, `ℹ️ Connection state: ${connection}`)
        }
        st.lastAt = now
      }
      st.lastState = connection
      connNotifyState.set(telegramId, st)
    }
  })

  // message handler — prefix-only commands
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    const msg = messages[0]
    if (!msg?.message || msg.key.fromMe) return

    const jid = msg.key.remoteJid
    const participant = msg.key.participant || msg.key.remoteJid
    const text = extractMessageText(msg)
    if (!text) return

    // Anti-link for groups if enabled
    try {
      if (jid?.endsWith('@g.us')) {
        const settings = getGroupSettings(jid)
        if (settings?.antilink && /https?:\/\/|wa\.me\/|chat\.whatsapp\.com\//i.test(text)) {
          // try ignore admins & enforce
          try {
            const meta = await sock.groupMetadata(jid)
            const p = meta.participants.find(pp => pp.id === participant)
            if (!p?.admin) {
              const me = (await sock.user).id
              const botP = meta.participants.find(pp => pp.id === me)
              if (botP?.admin) {
                await sock.sendMessage(jid, { text: `🚫 Anti-link: @${participant.split('@')[0]} — links are not allowed. Removing...`, mentions: [participant] })
                await sock.groupParticipantsUpdate(jid, [participant], 'remove')
              } else {
                await sock.sendMessage(jid, { text: `⚠️ Anti-link: @${participant.split('@')[0]} posted a link. I need admin permissions to remove.`, mentions: [participant] })
              }
            }
          } catch (e) { console.error('Anti-link error', e.message) }
          return
        }
      }
    } catch (e) { console.error('Anti-link top layer', e.message) }

    // only process commands that start with the prefix
    if (!text.startsWith(PREFIX)) return
    const parts = text.slice(PREFIX.length).trim().split(/\s+/)
    const cmdName = (parts.shift() || '').toLowerCase()
    const args = parts
    const cmd = COMMANDS.get(cmdName)
    if (!cmd) {
      return sock.sendMessage(jid, { text: `❓ Unknown command. Use ${PREFIX}help` })
    }
    try {
      await cmd.execute(sock, msg, args)
    } catch (e) {
      console.error('Command error', e)
      await sock.sendMessage(jid, { text: `⚠️ Error running ${PREFIX}${cmdName}: ${e.message || 'unknown'}` })
    }
  })

  return sock
}

// Telegram pairing flow
tgBot.onText(/\/pair/, (msg) => {
  const chatId = msg.chat.id.toString()
  if (!AUTHORIZED_USERS.includes(chatId)) {
    return tgBot.sendMessage(chatId, '❌ You are not authorized to pair the bot. Contact OWNER.')
  }
  if (activePairing.get(chatId)) return tgBot.sendMessage(chatId, '⚠️ Pairing already in progress.')

  tgBot.sendMessage(chatId, '📌 Reply with your WhatsApp number (country code, no +). Example: 2348012345678')
  activePairing.set(chatId, true)

  const listener = async (reply) => {
    if (reply.chat.id.toString() !== chatId) return
    const phone = (reply.text || '').replace(/\D/g, '')
    tgBot.removeListener('message', listener)
    activePairing.delete(chatId)
    if (!phone) return tgBot.sendMessage(chatId, '❌ Invalid number. Run /pair again.')

    try {
      await startWhatsAppBot(chatId, phone)
      tgBot.sendMessage(chatId, `✅ Pair process started for ${phone}. You will receive a QR image to scan shortly.`)
    } catch (e) {
      console.error('Pair start failed', e)
      tgBot.sendMessage(chatId, `❌ Failed to start pairing: ${e.message}`)
    }
  }

  tgBot.on('message', listener)
})

// reload commands (owner only)
tgBot.onText(/\/reload/, (msg) => {
  const chatId = msg.chat.id.toString()
  if (chatId !== (OWNER_TELEGRAM_ID || '').toString()) return tgBot.sendMessage(chatId, '❌ Only owner can reload.')
  // clear require cache for commands
  const cmdDir = path.join(__dirname, 'commands')
  if (fs.existsSync(cmdDir)) {
    for (const key of Object.keys(require.cache)) {
      if (key.startsWith(cmdDir)) delete require.cache[key]
    }
  }
  COMMANDS = loadCommands()
  tgBot.sendMessage(chatId, `🔄 Reloaded ${COMMANDS.size} commands.`)
})

// Express keep-alive
const app = express()
app.get('/', (_req, res) => res.send('✅ SIANO-MD (WhatsApp + Telegram) is running!'))
app.listen(PORT, () => console.log(`Server listening on port ${PORT} — prefix ${PREFIX}`))
