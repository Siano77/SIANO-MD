const yts = require('yt-search');

module.exports = {
  name: "play",
  description: "Download music from YouTube",
  async execute(sock, m, args) {
    if (!args[0]) {
      await sock.sendMessage(m.key.remoteJid, { text: "❌ Please provide a song name." }, { quoted: m });
      return;
    }
    const query = args.join(" ");
    const res = await yts(query);
    const video = res.videos[0];
    if (!video) {
      await sock.sendMessage(m.key.remoteJid, { text: "❌ No results found." }, { quoted: m });
      return;
    }
    await sock.sendMessage(m.key.remoteJid, {
      text: `🎵 *${video.title}*\n\n🔗 ${video.url}`
    }, { quoted: m });
  },
};
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = {
  // existing commands like sticker, play, ytmp3, ytmp4 ...

  // --- New commands ---

  viewonce: async ({ sock, msg }) => {
    if (!msg.message?.imageMessage && !msg.message?.videoMessage) {
      return 'Reply to a *view-once* image or video with #viewonce';
    }

    // Clone the original message and remove viewOnce flag
    const type = Object.keys(msg.message).find(k => k.endsWith('Message'));
    const original = msg.message[type];
    original.viewOnce = false;

    // Download media
    const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: sock.logger, reuploadRequest: sock.updateMediaMessage });

    return { [type.replace('Message','')]: buffer };
  },

  mode: async ({ args }) => {
    // Example: a simple bot mode switch
    const mode = (args[0] || '').toLowerCase();
    if (!['normal','silent','fun'].includes(mode)) return 'Usage: #mode <normal|silent|fun>';
    // You can store this mode in a global variable or db
    return `✅ Bot mode set to *${mode}*`;
  }
};
