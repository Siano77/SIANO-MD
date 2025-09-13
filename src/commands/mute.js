module.exports = {
  name: 'mute',
  description: 'Set group to admins-only',
  async execute(sock, msg) {
    const jid = msg.key.remoteJid
    try {
      await sock.groupSettingUpdate(jid, 'announcement')
      await sock.sendMessage(jid, { text: '🔒 Group muted — admins only' })
    } catch (e) {
      await sock.sendMessage(jid, { text: '❌ ' + e.message })
    }
  }
        }
