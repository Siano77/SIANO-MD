module.exports = {
  name: "kick",
  description: "Kick a member from group",
  async execute(sock, m, args) {
    if (!m.key.remoteJid.endsWith('@g.us')) {
      await sock.sendMessage(m.key.remoteJid, { text: "❌ This command only works in groups." }, { quoted: m });
      return;
    }
    if (!m.message.extendedTextMessage || !m.message.extendedTextMessage.contextInfo.participant) {
      await sock.sendMessage(m.key.remoteJid, { text: "❌ Tag a user to kick." }, { quoted: m });
      return;
    }
    const user = m.message.extendedTextMessage.contextInfo.participant;
    await sock.groupParticipantsUpdate(m.key.remoteJid, [user], "remove");
    await sock.sendMessage(m.key.remoteJid, { text: "✅ User has been removed." }, { quoted: m });
  },
};
