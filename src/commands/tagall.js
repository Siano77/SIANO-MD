module.exports = {
  name: 'tagall',
  description: 'Mention everyone in the group',
  async execute(sock, msg) {
    const jid = msg.key.remoteJid
    try {
      const meta = await sock.groupMetadata(jid)
      const mentions = meta.participants.map(p => p.id)
      await sock.sendMessage(jid, { text: '📢 Tagging everyone', mentions })
    } catch (e) {
      await sock.sendMessage(jid, { text: '❌ Failed to tag all: ' + e.message })
    }
  }
        }
