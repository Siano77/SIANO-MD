module.exports = {
  name: 'ping',
  description: 'Check bot responsiveness',
  async execute(sock, msg) {
    const jid = msg.key.remoteJid
    await sock.sendMessage(jid, { text: '🏓 Pong!' })
  }
}
