const fetch = require('node-fetch');

module.exports = {
  name: "joke",
  description: "Send a random joke",
  async execute(sock, m) {
    try {
      const res = await fetch('https://v2.jokeapi.dev/joke/Any');
      const data = await res.json();
      const joke = data.type === "single" ? data.joke : `${data.setup}\n${data.delivery}`;
      await sock.sendMessage(m.key.remoteJid, { text: `😂 ${joke}` }, { quoted: m });
    } catch (e) {
      await sock.sendMessage(m.key.remoteJid, { text: "❌ Failed to fetch joke." }, { quoted: m });
    }
  },
};
