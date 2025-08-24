const { prefix, owner, botName } = require('./utils/config');

// Main command handler
async function handleMessage(sock, m) {
    const message = m.message?.conversation || m.message?.extendedTextMessage?.text;
    if (!message) return;

    const jid = m.key.remoteJid;
    const from = m.key.participant || jid;

    // Ignore messages that don't start with prefix
    if (!message.startsWith(prefix())) return;

    const args = message.slice(prefix().length).trim().split(/ +/);
    const cmd = args.shift().toLowerCase();

    switch (cmd) {
        case 'ping':
            await sock.sendMessage(jid, { text: `🏓 Pong! ${botName()} is online.` });
            break;

        case 'owner':
            await sock.sendMessage(jid, { text: `Owner: ${owner()}` });
            break;

        case 'help':
            await sock.sendMessage(jid, { text: `Hi! I'm ${botName()}.\nUse commands with prefix: ${prefix()}\nCommands: ping, owner, help, fun, admin, media` });
            break;

        // Add more commands here: fun, media, admin...
        default:
            break;
    }
}

module.exports = handleMessage;
