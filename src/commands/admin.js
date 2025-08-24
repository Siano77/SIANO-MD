const { setGroupSetting } = require('../utils/store')

async function requireGroup(msg) {
  return msg.key.remoteJid.endsWith('@g.us')
}

module.exports = {
  kick: async ({ sock, msg, args }) => {
    const inGroup = await requireGroup(msg)
    if (!inGroup) return 'Group only.'
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    const target = mentioned || (args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net')
    if (!target) return 'Tag a user or provide number.'
    await sock.groupParticipantsUpdate(msg.key.remoteJid, [target], 'remove')
    return `👢 Kicked @${target.split('@')[0]}`
  },

  add: async ({ sock, msg, args }) => {
    const inGroup = await requireGroup(msg)
    if (!inGroup) return 'Group only.'
    if (!args[0]) return 'Usage: #add <number>'
    const target = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net'
    await sock.groupParticipantsUpdate(msg.key.remoteJid, [target], 'add')
    return `➕ Invited ${args[0]}`
  },

  promote: async ({ sock, msg, args }) => {
    const inGroup = await requireGroup(msg)
    if (!inGroup) return 'Group only.'
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    const target = mentioned || (args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net')
    if (!target) return 'Tag a user or provide number.'
    await sock.groupParticipantsUpdate(msg.key.remoteJid, [target], 'promote')
    return `👑 Promoted @${target.split('@')[0]}`
  },

  demote: async ({ sock, msg, args }) => {
    const inGroup = await requireGroup(msg)
    if (!inGroup) return 'Group only.'
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    const target = mentioned || (args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net')
    if (!target) return 'Tag a user or provide number.'
    await sock.groupParticipantsUpdate(msg.key.remoteJid, [target], 'demote')
    return `⬇️ Demoted @${target.split('@')[0]}`
  },

  mute: async ({ sock, msg }) => {
    await sock.groupSettingUpdate(msg.key.remoteJid, 'announcement')
    return '🔒 Group muted (admins only)'
  },

  unmute: async ({ sock, msg }) => {
    await sock.groupSettingUpdate(msg.key.remoteJid, 'not_announcement')
    return '🔓 Group unmuted (everyone can send)'
  },

  tagall: async ({ sock, msg }) => {
    const inGroup = await requireGroup(msg)
    if (!inGroup) return 'Group only.'
    const metadata = await sock.groupMetadata(msg.key.remoteJid)
    const mentions = metadata.participants.map(p => p.id)
    await sock.sendMessage(msg.key.remoteJid, { text: '📣 Attention everyone!', mentions })
    return '✅ Tagall executed.'
  },

  hidetag: async ({ sock, msg }) => {
    const inGroup = await requireGroup(msg)
    if (!inGroup) return 'Group only.'
    const metadata = await sock.groupMetadata(msg.key.remoteJid)
    const mentions = metadata.participants.map(p => p.id)
    await sock.sendMessage(msg.key.remoteJid, { text: msg.message?.conversation || ' ', mentions })
    return '✅ Hidetag executed.'
  },

  ban: async ({ sock, msg, args }) => {
    const target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || (args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net')
    if (!target) return 'Tag a user or provide number.'
    await sock.groupParticipantsUpdate(msg.key.remoteJid, [target], 'remove')
    return `⛔ Banned @${target.split('@')[0]}`
  },

  gclink: async ({ sock, msg }) => {
    const metadata = await sock.groupInviteCode(msg.key.remoteJid)
    return `🔗 Group link: https://chat.whatsapp.com/${metadata}`
  },

  setdesc: async ({ sock, msg, args }) => {
    const text = args.join(' ')
    if (!text) return 'Usage: #setdesc <text>'
    await sock.groupUpdateDescription(msg.key.remoteJid, text)
    return '✅ Group description updated.'
  },

  lock: async ({ sock, msg }) => {
    await sock.groupSettingUpdate(msg.key.remoteJid, 'announcement')
    return '🔒 Group locked (admins only)'
  },

  unlock: async ({ sock, msg }) => {
    await sock.groupSettingUpdate(msg.key.remoteJid, 'not_announcement')
    return '🔓 Group unlocked (everyone can send)'
  },

  antilink: async ({ msg, args }) => {
    const onoff = (args[0] || '').toLowerCase()
    if (!['on','off'].includes(onoff)) return 'Usage: #antilink on|off'
    setGroupSetting(msg.key.remoteJid,'antilink', onoff==='on')
    return `🔗 Anti-link ${onoff==='on'?'enabled':'disabled'}`
  },

  antispam: async ({ args }) => {
    const onoff = (args[0] || '').toLowerCase()
    if (!['on','off'].includes(onoff)) return 'Usage: #antispam on|off'
    setGroupSetting('global-antispam', onoff==='on')
    return `⚡ Anti-spam ${onoff==='on'?'enabled':'disabled'}`
  }
  }
