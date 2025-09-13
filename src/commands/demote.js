module.exports = {
  name: 'demote',
  description: 'Demote admin to member (reply or mention)',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    const target = mentioned || (args[0] ? args[0].replace(/\D/g,'') + '@s.whatsapp.net' : null)
    if (!target) return sock.sendMessage(jid, { text: 'Usage: #demote @user or reply' })
    try {
      await sock.groupParticipantsUpdate(jid, [target], 'demote')
      await sock.sendMessage(jid, { text: `⬇️ Demoted @${target.split('@')[0]}`, mentions: [target] })
    } catch (e) {
      await sock.sendMessage(jid, { text: '❌ ' + e.message })
    }
  }
      }
