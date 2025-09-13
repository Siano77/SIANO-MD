const { setGroupSetting } = require('../utils/store')
module.exports = {
  name: 'antilink',
  description: 'Toggle anti-link protection in this group: #antilink on|off',
  async execute(sock, msg, args) {
    const jid = msg.key.remoteJid
    if (!jid.endsWith('@g.us')) return sock.sendMessage(jid, { text: 'Group only.' })
    const onoff = (args[0] || '').toLowerCase()
    if (!['on','off'].includes(onoff)) return sock.sendMessage(jid, { text: 'Usage: #antilink on|off' })
    setGroupSetting(jid, 'antilink', onoff === 'on')
    return sock.sendMessage(jid, { text: `🔗 Anti-link ${onoff === 'on' ? 'enabled' : 'disabled'}` })
  }
      }
