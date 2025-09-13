module.exports = {
  name: 'unmute',
  description: 'Allow everyone to send messages',
  async execute(sock, msg) {
    const jid = msg.key.remoteJid
    try {
      await sock.groupSettingUpdate(jid, 'not_announcement')
      await sock.sendMessage(jid, { text: '🔓 Group unmuted — everyone can chat' })
    } catch (e) {
      await sock.sendMessage(jid, { text: '❌ ' + e.message })
    }
  }
  }
