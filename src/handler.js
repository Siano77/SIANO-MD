const fun = require('./commands/fun')
const media = require('./commands/media')
const admin = require('./commands/admin')
const welcome = require('./commands/welcome')
const help = require('./commands/help')
const utility = require('./commands/utility') // ping, viewonce, mode

const all = { ...fun, ...media, ...admin, ...welcome, ...help, ...utility }
