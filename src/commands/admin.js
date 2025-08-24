const { setGroupSetting } = require('../utils/store')

async function requireGroup(msg) { 
  return msg.key.remoteJid.endsWith('@g.us') 
}

module.exports = {
  // Kick user
  kick: async ({ sock, msg, args }) => {
    if (!await requireGroup(msg)) return 'Group only.'
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    if (!mentioned && !args[0]) return 'Tag a user or provide number.'
    const target = mentioned || (args[0].replace(/[^0-9]/g,'')+'@s.whatsapp.net')
    await sock.groupParticipantsUpdate(msg.key.remoteJid,[target],'remove')
    return `👢 Kicked @${target.split('@')[0]}`
  },

  // Add user
  add: async ({ sock, msg, args }) => {
    if (!await requireGroup(msg)) return 'Group only.'
    if (!args[0]) return 'Usage: #add <number>'
    const target = args[0].replace(/[^0-9]/g,'')+'@s.whatsapp.net'
    await sock.groupParticipantsUpdate(msg.key.remoteJid,[target],'add')
    return `➕ Invited ${args[0]}`
  },

  // Promote user
  promote: async ({ sock, msg, args }) => {
    if (!await requireGroup(msg)) return 'Group only.'
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    if (!mentioned && !args[0]) return 'Tag a user or provide number.'
    const target = mentioned || (args[0].replace(/[^0-9]/g,'')+'@s.whatsapp.net')
    await sock.groupParticipantsUpdate(msg.key.remoteJid,[target],'promote')
    return `👑 Promoted @${target.split('@')[0]}`
  },

  // Demote user
  demote: async ({ sock, msg, args }) => {
    if (!await requireGroup(msg)) return 'Group only.'
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    if (!mentioned && !args[0]) return 'Tag a user or provide number.'
    const target = mentioned || (args[0].replace(/[^0-9]/g,'')+'@s.whatsapp.net')
    await sock.groupParticipantsUpdate(msg.key.remoteJid,[target],'demote')
    return `⬇️ Demoted @${target.split('@')[0]}`
  },

  // Mute group (only admins can send)
  mute: async ({ sock, msg }) => { 
    if (!await requireGroup(msg)) return 'Group only.'
    await sock.groupSettingUpdate(msg.key.remoteJid,'announcement') 
    return '🔒 Group muted (admins only)' 
  },

  // Unmute group (everyone can send)
  unmute: async ({ sock, msg }) => { 
    if (!await requireGroup(msg)) return 'Group only.'
    await sock.groupSettingUpdate(msg.key.remoteJid,'not_announcement') 
    return '🔓 Group unmuted (everyone can send)' 
  },

  // Tag all members
  tagall: async ({ sock, msg }) => {
    if (!await requireGroup(msg)) return 'Group only.'
    const participants = msg.message?.key?.remoteJid ? await sock.groupMetadata(msg.key.remoteJid) : null
    if (!participants) return 'Could not fetch group members.'
    const mentions = participants.participants.map(p => p.id)
    await sock.sendMessage(msg.key.remoteJid, { text: '📢 @everyone', mentions })
    return '✅ Tagged all members.'
  },

  // Hide tag (silent mention)
  hidetag: async ({ sock, msg, args }) => {
    if (!await requireGroup(msg)) return 'Group only.'
    const text = args.join(' ') || ' '
    const participants = (await sock.groupMetadata(msg.key.remoteJid)).participants.map(p => p.id)
    await sock.sendMessage(msg.key.remoteJid, { text, mentions: participants })
    return '✅ Message sent with hidden mentions.'
  },

  // Ban user
  ban: async ({ sock, msg, args }) => {
    if (!await requireGroup(msg)) return 'Group only.'
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]
    if (!mentioned && !args[0]) return 'Tag a user or provide number.'
    const target = mentioned || (args[0].replace(/[^0-9]/g,'')+'@s.whatsapp.net')
    await sock.groupParticipantsUpdate(msg.key.remoteJid,[target],'remove')
    return `⛔ Banned @${target.split('@')[0]}`
  },

  // Get group invite link
  gclink: async ({ sock, msg }) => {
    if (!await requireGroup(msg)) return 'Group only.'
    const info = await sock.groupInviteCode(msg.key.remoteJid)
    return `🔗 Group Link: https://chat.whatsapp.com/${info}`
  },

  // Set group description
  setdesc: async ({ sock, msg, args }) => {
    if (!await requireGroup(msg)) return 'Group only.'
    const text = args.join(' ')
    if (!text) return 'Usage: #setdesc <text>'
    await sock.groupUpdateDescription(msg.key.remoteJid, text)
    return '✏️ Group description updated.'
  },

  // Lock group
  lock: async ({ sock, msg }) => {
    if (!await requireGroup(msg)) return 'Group only.'
    await sock.groupSettingUpdate(msg.key.remoteJid,'announcement')
    return '🔒 Group locked (only admins can send messages).'
  },

  // Unlock group
  unlock: async ({ sock, msg }) => {
    if (!await requireGroup(msg)) return 'Group only.'
    await sock.groupSettingUpdate(msg.key.remoteJid,'not_announcement')
    return '🔓 Group unlocked (everyone can send messages).'
  }
  }
