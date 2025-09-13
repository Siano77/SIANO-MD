module.exports = {
  name: 'help',
  description: 'Show categorized help',
  async execute(sock, msg) {
    const jid = msg.key.remoteJid
    const p = process.env.PREFIX || '#'
    const text = [
      `✨ *${process.env.BOT_NAME || 'SIANO-MD'} — Help* ✨`,
      '',
      `*Main*`,
      `• ${p}help — show this menu`,
      `• ${p}ping — bot health check`,
      '',
      `*Group*`,
      `• ${p}tagall, ${p}hidetag <text>`,
      `• ${p}mute, ${p}unmute`,
      `• ${p}promote @user, ${p}demote @user`,
      `• ${p}antilink on|off`,
      '',
      `*Download*`,
      `• ${p}play <search> — search & show top video`,
      `• ${p}ytmp3 <url> — audio`,
      `• ${p}ytmp4 <url> — video`,
      '',
      `*AI*`,
      `• ${p}ai <question>`,
      '',
      `*Owner*`,
      `• ${p}broadcast <text>`,
      `• ${p}restart`,
      '',
      `Prefix: *${p}*`
    ].join('\n')
    await sock.sendMessage(jid, { text })
  }
      }
