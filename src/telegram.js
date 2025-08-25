require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

bot.on('message', (msg) => {
  bot.sendMessage(msg.chat.id, `Hello ${msg.from.first_name}, your bot is live 🚀`);
});

module.exports = bot;
