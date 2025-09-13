module.exports = {
  name: 'hidetag',
  description: 'Ping everyone with a message (mentions included)',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid
    const text = args.join(' ') || 'Hidetag'
    try {
      const meta = await sock.groupMetadata(jid)
      const mentions = meta.participants.map(p => p.id)
      await sock.sendMessage(jid, { text, mentions })
    } catch (e) {
      await sock.sendMessage(jid, { text: '❌ failed: ' + e.message })
    }
  }
      }
