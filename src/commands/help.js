const { prefix, botName } = require('../utils/config')

module.exports = {
  help: async () => {
    const p = prefix()
    return [
      `🤖 *${botName()}* — Commands`,

      '',
      '🎮 *Fun*',
      `${p}dice, ${p}coin, ${p}rps <rock|paper|scissors>, ${p}meme, ${p}cat, ${p}dog, ${p}ping`,

      '',
      '🖼️ *Media*',
      `${p}sticker (reply to image), ${p}play <song>, ${p}ytmp3 <url>, ${p}ytmp4 <url>, ${p}viewonce, ${p}mode <normal|silent|fun>`,

      '',
      '👑 *Admin*',
      `${p}kick <@user>, ${p}add <number>, ${p}promote <@user>, ${p}demote <@user>, ${p}mute, ${p}unmute, ${p}tagall, ${p}hidetag, ${p}ban <@user>, ${p}gclink, ${p}setdesc <text>, ${p}lock, ${p}unlock`,

      '',
      '👋 *Welcome*',
      `${p}welcome on|off, ${p}setwelcome <message with @user>`,

      '',
      '🛡️ *Protection*',
      `${p}antilink on|off, ${p}antispam on|off`,
    ].join('\n')
  }
          }
