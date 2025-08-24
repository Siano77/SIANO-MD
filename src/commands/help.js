const { prefix, botName } = require('../utils/config')

module.exports = {
  help: async () => {
    const p = prefix()
    const name = botName()

    return [
      `🤖 *${name}* — Commands`,
      '',
      '🎮 *Fun*',
      `${p}dice, ${p}coin, ${p}rps <rock|paper|scissors>, ${p}meme, ${p}cat, ${p}dog`,
      '',
      '🖼️ *Media*',
      `${p}sticker (reply to image), ${p}play <song>, ${p}ytmp3 <url>, ${p}ytmp4 <url>`,
      '',
      '👑 *Admin*',
      `${p}kick <@user>, ${p}add <number>, ${p}promote <@user>, ${p}demote <@user>, ${p}mute, ${p}unmute`,
      `${p}tagall, ${p}hidetag <text>, ${p}ban <@user>, ${p}gclink, ${p}setdesc <text>, ${p}lock, ${p}unlock`,
      '',
      '👋 *Welcome*',
      `${p}welcome on|off, ${p}setwelcome <message with @user>`,
      '',
      '🛡️ *Protection*',
      `${p}antilink on|off, ${p}antispam on|off`,
      '',
      '⚡ *Utility*',
      `${p}ping, ${p}mode, ${p}viewonce`,
      '',
      '📖 *Usage*',
      `Type a command with the prefix "${p}" followed by command name and arguments if any.`,
      `Example: ${p}play Despacito`
    ].join('\n')
  }
      }
