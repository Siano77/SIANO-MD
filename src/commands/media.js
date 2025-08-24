const { downloadMediaMessage } = require('@whiskeysockets/baileys')
const yts = require('yt-search')
const ytdl = require('ytdl-core')

module.exports = {
  sticker: async ({ sock, msg }) => {
    if (!msg.message?.imageMessage) return 'Reply to an *image* with #sticker'
    const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: sock.logger, reuploadRequest: sock.updateMediaMessage })
    return { sticker: buffer }
  },
  play: async ({ args }) => {
    const q = args.join(' ')
    if (!q) return 'Usage: #play <song>'
    const res = await yts(q)
    const v = res.videos?.[0]
    if (!v) return '❌ No results found.'
    return `🎵 *${v.title}*\n⏱️ ${v.timestamp}\n👤 ${v.author.name}\n🔗 ${v.url}`
  },
  ytmp3: async ({ args }) => {
    const url = args[0]
    if (!url || !ytdl.validateURL(url)) return 'Usage: #ytmp3 <youtube-url>'
    const info = await ytdl.getInfo(url)
    const format = ytdl.chooseFormat(info.formats, { quality: '140' })
    const chunks = []
    return new Promise((resolve, reject) => {
      ytdl.downloadFromInfo(info, { format })
        .on('data', c => chunks.push(c))
        .on('end', () => resolve({ audio: Buffer.concat(chunks), mimetype: 'audio/mp4', ptt: false, fileName: (info.videoDetails.title||'audio')+'.m4a' }))
        .on('error', () => resolve('❌ Download failed.'))
    })
  },
  ytmp4: async ({ args }) => {
    const url = args[0]
    if (!url || !ytdl.validateURL(url)) return 'Usage: #ytmp4 <youtube-url>'
    const info = await ytdl.getInfo(url)
    const format = ytdl.chooseFormat(info.formats, { quality: '18' })
    const chunks = []
    return new Promise((resolve, reject) => {
      ytdl.downloadFromInfo(info, { format })
        .on('data', c => chunks.push(c))
        .on('end', () => resolve({ video: Buffer.concat(chunks), mimetype: 'video/mp4', fileName: (info.videoDetails.title||'video')+'.mp4' }))
        .on('error', () => resolve('❌ Download failed.'))
    })
  }
      }
