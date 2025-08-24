require('dotenv').config()

function prefix() { 
    return process.env.PREFIX || '#' 
}

function owner()  { 
    return process.env.OWNER_NUMBER || '' 
}

function botName(){ 
    return process.env.BOT_NAME || 'SIANO-MD' 
}

module.exports = { prefix, owner, botName }
