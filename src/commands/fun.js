const axios = require('axios')

module.exports = {
  dice: async () => `🎲 You rolled: ${Math.floor(Math.random() * 6) + 1}`,
  coin: async () => `🪙 ${Math.random() < 0.5 ? 'Heads' : 'Tails'}`,
  rps: async ({ args }) => {
    const you = (args[0] || '').toLowerCase()
    const opts = ['rock','paper','scissors']
    if (!opts.includes(you)) return 'Usage: #rps <rock|paper|scissors>'
    const bot = opts[Math.floor(Math.random() * 3)]
    const res = you === bot ? '🤝 Draw!' :
      (you === 'rock' && bot === 'scissors') ||
      (you === 'scissors' && bot === 'paper') ||
      (you === 'paper' && bot === 'rock') ? '✅ You win!' : '❌ You lose!'
    return `You: ${you}\nBot: ${bot}\n${res}`
  },
  meme: async () => {
    const { data } = await axios.get('https://meme-api.com/gimme')
    return { image: { url: data.url }, caption: data.title }
  },
  cat: async () => {
    const { data } = await axios.get('https://api.thecatapi.com/v1/images/search')
    return { image: { url: data[0].url }, caption: '🐱 Meow!' }
  },
  dog: async () => {
    const { data } = await axios.get('https://dog.ceo/api/breeds/image/random')
    return { image: { url: data.message }, caption: '🐶 Woof!' }
  }
       }
