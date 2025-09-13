const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(process.cwd(), 'data')
const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json')

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(SETTINGS_PATH)) {
    const initial = { global: { antispam: true }, groups: {} }
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(initial, null, 2))
  }
}

function read() {
  ensureStore()
  return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'))
}
function write(obj) {
  ensureStore()
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(obj, null, 2))
}

function getGroupSettings(jid) {
  const db = read()
  if (!db.groups[jid]) {
    db.groups[jid] = { welcome: false, welcomeText: 'Welcome to the group, @user 🎉', antilink: false }
    write(db)
  }
  return db.groups[jid]
}
function setGroupSetting(jid, key, value) {
  const db = read()
  db.groups[jid] = db.groups[jid] || {}
  db.groups[jid][key] = value
  write(db)
  return db.groups[jid]
}
function getGlobal(key, fallback) {
  const db = read()
  return (db.global && db.global[key]) ?? fallback
}
function setGlobal(key, value) {
  const db = read()
  db.global = db.global || {}
  db.global[key] = value
  write(db)
}

module.exports = { ensureStore, getGroupSettings, setGroupSetting, getGlobal, setGlobal }
