const { botName } = require('../utils/config')

// Ping command
module.exports.ping = async () => {
  const start = Date.now()
  return `🏓 Pong! Response time: ${Date.now() - start}ms`
}

// View Once Exposed
module.exports.viewonce = async ({ msg }) => {
  if (!msg.message?.imageMessage && !msg.message?.videoMessage) {
    return '❌ Reply to a "View Once" image or video to expose it.'
  }
  const media = msg.message.imageMessage || msg.message.videoMessage
  return { 
    image: media?.mimetype?.startsWith('image') ? media : undefined,
    video: media?.mimetype?.startsWith('video') ? media : undefined,
    caption: `📤 View Once Exposed by ${botName()}`
  }
}

// Mode command (example: toggle bot mode)
let modeStatus = 'public' // default mode

module.exports.mode = async () => {
  modeStatus = modeStatus === 'public' ? 'private' : 'public'
  return `⚡ Bot mode is now: *${modeStatus}*`
      }
