const { getGroupSettings } = require('./store')

const WA_LINK = /chat\.whatsapp\.com\/[A-Za-z0-9]+/i

// Check if a user is admin
async function isAdmin(sock, jid, userJid) {
  const meta = await sock.groupMetadata(jid)
  const participant = meta.participants.find(p => p.id === userJid)
  return !!participant?.admin
}

// Check if bot is admin
async function isBotAdmin(sock, jid) {
  const meta = await sock.groupMetadata(jid)
  const bot = meta.participants.find(p => p.id === (await sock.user.id))
  return !!bot?.admin
}

// Anti-link handler
async function handleAntiLinkOnMessage(sock, m) {
  const jid = m.key.remoteJid
  if (!jid.endsWith('@g.us')) return // Only groups

  const body = m.message?.conversation || m.message?.extendedTextMessage?.text || ''
  if (!body) return

  const settings = getGroupSettings(jid)
  if (!settings.antilink) return
  if (!WA_LINK.test(body)) return

  const sender = m.key.participant
  const admin = await isAdmin(sock, jid, sender)
  if (admin) return // Ignore admins

  const botAdmin = await isBotAdmin(sock, jid)

  if (botAdmin) {
    try {
      await sock.sendMessage(jid, { 
        text: `🔗 Anti-link: @${sender.split('@')[0]} — removing…`, 
        mentions: [sender] 
      })
      await sock.groupParticipantsUpdate(jid, [sender], 'remove')
    } catch (e) {
      await sock.sendMessage(jid, { 
        text: `⚠️ Anti-link triggered for @${sender.split('@')[0]} but I lack permissions.`, 
        mentions: [sender] 
      })
    }
  } else {
    await sock.sendMessage(jid, { 
      text: `⚠️ Anti-link triggered by @${sender.split('@')[0]} — make me *admin* to enforce.`, 
      mentions: [sender] 
    })
  }
}

module.exports = { handleAntiLinkOnMessage }
