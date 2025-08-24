module.exports = {
  name: "help",
  description: "Show all available commands",
  async execute(sock, m, args, config) {
    const helpText = `
🤖 *${config.BOT_NAME} Command Menu* 🤖

📌 General:
#help - Show this menu
#sticker - Make sticker from image
#play <song name> - Download music from YouTube
#image <query> - Search & send image

😂 Fun:
#joke - Random joke
#meme - Random meme

🎥 Media:
#ytmp3 <url> - YouTube audio
#ytmp4 <url> - YouTube video

👮 Admin:
#kick @user - Remove user
#promote @user - Promote to admin
#demote @user - Demote admin
#antilink on/off - Toggle anti-link
#antispam on/off - Toggle anti-spam

👋 Group:
#welcome <message> - Set custom welcome
#welcome off - Disable welcome messages
    `;
    await sock.sendMessage(m.key.remoteJid, { text: helpText }, { quoted: m });
  },
};
