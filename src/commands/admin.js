const { setGlobal, getGlobal, setGroupSetting } = require('../utils/store');

async function requireGroup(msg) {
    return msg.key.remoteJid.endsWith('@g.us');
}

// ===== Previous commands =====

// Kick a member
module.exports.kick = async ({ sock, msg, args }) => {
    const inGroup = await requireGroup(msg); if (!inGroup) return 'Group only.';
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentioned && !args[0]) return 'Tag a user or provide number.';
    const target = mentioned || (args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net');
    await sock.groupParticipantsUpdate(msg.key.remoteJid, [target], 'remove');
    return `👢 Kicked @${target.split('@')[0]}`;
};

// Add member
module.exports.add = async ({ sock, msg, args }) => {
    const inGroup = await requireGroup(msg); if (!inGroup) return 'Group only.';
    if (!args[0]) return 'Usage: #add <number>';
    const target = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    await sock.groupParticipantsUpdate(msg.key.remoteJid, [target], 'add');
    return `➕ Invited ${args[0]}`;
};

// Promote
module.exports.promote = async ({ sock, msg, args }) => {
    const inGroup = await requireGroup(msg); if (!inGroup) return 'Group only.';
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentioned && !args[0]) return 'Tag a user or provide number.';
    const target = mentioned || (args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net');
    await sock.groupParticipantsUpdate(msg.key.remoteJid, [target], 'promote');
    return `👑 Promoted @${target.split('@')[0]}`;
};

// Demote
module.exports.demote = async ({ sock, msg, args }) => {
    const inGroup = await requireGroup(msg); if (!inGroup) return 'Group only.';
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentioned && !args[0]) return 'Tag a user or provide number.';
    const target = mentioned || (args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net');
    await sock.groupParticipantsUpdate(msg.key.remoteJid, [target], 'demote');
    return `⬇️ Demoted @${target.split('@')[0]}`;
};

// Mute group
module.exports.mute = async ({ sock, msg }) => {
    await sock.groupSettingUpdate(msg.key.remoteJid, 'announcement');
    return '🔒 Group muted (admins only)';
};

// Unmute group
module.exports.unmute = async ({ sock, msg }) => {
    await sock.groupSettingUpdate(msg.key.remoteJid, 'not_announcement');
    return '🔓 Group unmuted (everyone can send)';
};

// Enable/disable anti-link
module.exports.antilink = async ({ msg, args }) => {
    const onoff = (args[0] || '').toLowerCase();
    if (!['on', 'off'].includes(onoff)) return 'Usage: #antilink on|off';
    setGroupSetting(msg.key.remoteJid, 'antilink', onoff === 'on');
    return `🔗 Anti-link ${onoff === 'on' ? 'enabled' : 'disabled'}`;
};

// Enable/disable anti-spam
module.exports.antispam = async ({ args }) => {
    const onoff = (args[0] || '').toLowerCase();
    if (!['on', 'off'].includes(onoff)) return 'Usage: #antispam on|off';
    setGlobal('antispam', onoff === 'on');
    return `⚡ Anti-spam ${onoff === 'on' ? 'enabled' : 'disabled'}`;
};

// Welcome toggle
module.exports.welcome = async ({ msg, args }) => {
    const onoff = (args[0] || '').toLowerCase();
    if (!['on','off'].includes(onoff)) return 'Usage: #welcome on/off';
    setGroupSetting(msg.key.remoteJid, 'welcome', onoff==='on');
    return `👋 Welcome messages ${onoff==='on'?'enabled':'disabled'}`;
};

// Set custom welcome message
module.exports.setwelcome = async ({ msg, args }) => {
    const text = args.join(' ');
    if (!text) return 'Usage: #setwelcome <message — use @user>';
    setGroupSetting(msg.key.remoteJid, 'welcomeText', text);
    return '✅ Custom welcome message saved.';
};

// ===== New commands =====

// Tag all members
module.exports.tagall = async ({ sock, msg }) => {
    const inGroup = await requireGroup(msg);
    if (!inGroup) return 'Group only.';
    const meta = await sock.groupMetadata(msg.key.remoteJid);
    const mentions = meta.participants.map(p => p.id);
    await sock.sendMessage(msg.key.remoteJid, { text: '🔔 Attention everyone!', mentions });
    return '✅ All members have been tagged.';
};

// Hide tag
module.exports.hidetag = async ({ sock, msg, args }) => {
    const inGroup = await requireGroup(msg);
    if (!inGroup) return 'Group only.';
    if (!args.length) return 'Usage: #hidetag <message>';
    const text = args.join(' ');
    await sock.sendMessage(msg.key.remoteJid, { text, mentions: [] });
    return '✅ Message sent without mention.';
};

// Ban member
module.exports.ban = async ({ sock, msg, args }) => {
    const inGroup = await requireGroup(msg);
    if (!inGroup) return 'Group only.';
    const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!mentioned && !args[0]) return 'Tag a user or provide number.';
    const target = mentioned || (args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net');
    await sock.groupParticipantsUpdate(msg.key.remoteJid, [target], 'remove');
    return `⛔ Banned @${target.split('@')[0]}`;
};

// Get group link
module.exports.gclink = async ({ sock, msg }) => {
    const inGroup = await requireGroup(msg);
    if (!inGroup) return 'Group only.';
    const invite = await sock.groupInviteCode(msg.key.remoteJid);
    return `🔗 Group link: https://chat.whatsapp.com/${invite}`;
};

// Set group description
module.exports.setdesc = async ({ sock, msg, args }) => {
    const inGroup = await requireGroup(msg);
    if (!inGroup) return 'Group only.';
    if (!args.length) return 'Usage: #setdesc <description>';
    const text = args.join(' ');
    await sock.groupUpdateDescription(msg.key.remoteJid, text);
    return '✅ Group description updated.';
};

// Lock group (admins only)
module.exports.lock = async ({ sock, msg }) => {
    const inGroup = await requireGroup(msg);
    if (!inGroup) return 'Group only.';
    await sock.groupSettingUpdate(msg.key.remoteJid, 'announcement');
    return '🔒 Group locked. Only admins can send messages now.';
};

// Unlock group (everyone)
module.exports.unlock = async ({ sock, msg }) => {
    const inGroup = await requireGroup(msg);
    if (!inGroup) return 'Group only.';
    await sock.groupSettingUpdate(msg.key.remoteJid, 'not_announcement');
    return '🔓 Group unlocked. Everyone can send messages now.';
};
