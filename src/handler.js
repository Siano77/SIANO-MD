const { antiSpamCheck } = require('./utils/spamGuard');

module.exports = async (sock, m, config) => {
  try {
    const from = m.key.remoteJid;
    const type = Object.keys(m.message)[0];
    const body = type === 'conversation'
      ? m.message.conversation
      : type === 'extendedTextMessage'
        ? m.message.extendedTextMessage.text
        : '';

    if (!body.startsWith(config.PREFIX)) return;

    // Prevent spam
    if (!antiSpamCheck(from)) {
      await sock.sendMessage(from, { text: '⚠️ Slow down! You are spamming.' }, { quoted: m });
      return;
    }

    const args = body.slice(config.PREFIX.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = sock.commands.get(commandName);
    if (!command) return;

    await command.execute(sock, m, args, config);

  } catch (err) {
    console.error('Handler Error:', err);
  }
};
