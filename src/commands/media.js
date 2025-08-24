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
