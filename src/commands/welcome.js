const { setWelcomeMessage, disableWelcomeMessage } = require('../utils/store');

module.exports = {
  name: "welcome",
  description: "Set or disable custom welcome messages",
  async execute(sock, m, args) {
    if (!m.key.remoteJid.endsWith('@g.us')) {
      await sock.sendMessage(m.key.remoteJid, { text: "❌ This command only works in groups." }, { quoted: m });
      return;
    }

    if (!args[0]) {
      await sock.sendMessage(m.key.remoteJid, { text: "❌ Usage: #welcome <message> OR #welcome off" }, { quoted: m });
      return;
    }

    if (args[0].toLowerCase() === "off") {
      disableWelcomeMessage(m.key.remoteJid);
      await sock.sendMessage(m.key.remoteJid, { text: "✅ Welcome messages disabled." }, { quoted: m });
      return;
    }

    const text = args.join(" ");
    setWelcomeMessage(m.key.remoteJid, text);
    await sock.sendMessage(m.key.remoteJid, { text: "✅ Welcome message set." }, { quoted: m });
  },
};
