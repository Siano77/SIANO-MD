⚡ Deploy on Fly.io

Deploy your WhatsApp bot globally in minutes using Fly.io.

Step 1 — Install Fly CLI

# macOS
brew install superfly/tap/flyctl

# Linux
curl -L https://fly.io/install.sh | sh

# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex

Log in to Fly:

flyctl auth login


---

Step 2 — Clone & Prepare Repo

git clone https://github.com/YOUR-USERNAME/md-whatsapp-bot.git
cd md-whatsapp-bot

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your phone number and bot name


---

Step 3 — Initialize Fly App

flyctl launch

Choose a name for your app (or leave blank for auto-name).

Select the nearest region.

Choose Node.js runtime.

Do not deploy yet.



---

Step 4 — Configure Persistent Storage (Optional)

# Create a volume for WhatsApp session & data
flyctl volumes create md-bot-data --size 1

Add to fly.toml:

[mounts]
  source="md-bot-data"
  destination="/app/data"


---

Step 5 — Deploy Bot

flyctl deploy

Fly will build a Node.js Docker image and deploy it.

After deployment, check logs to see QR code:


flyctl logs

Scan QR code with your WhatsApp number to connect the bot.



---

Step 6 — Manage Bot

# Check bot status
flyctl status

# Restart bot
flyctl restart

# View real-time logs
flyctl logs


---

✅ Your MD WhatsApp Bot is live!
Fly.io will keep it running 24/7 

MD WhatsApp Bot — Modular Deployment-Ready

[![Deploy to Fly.io](https://deploy.fly.io/button.svg)](https://fly.io/apps/new?repo=https://github.com/Siano77/siano-md-whatsapp-bot)

A fully modular WhatsApp bot built with **Baileys + Node.js**, ready for **local deployment** or **cloud hosting**.  

---

## **1️⃣ Features**

1. Prefix: `#`
2. 🎮 Fun commands: `#dice`, `#coin`, `#rps <rock|paper|scissors>`, `#meme`, `#cat`, `#dog`
3. 🖼️ Media: `#sticker` (image → sticker), `#play <song>`, `#ytmp3 <url>`, `#ytmp4 <url>`
4. 👑 Admin: `#kick`, `#add`, `#promote`, `#demote`, `#mute`, `#unmute`
5. 👋 Welcome messages: `#welcome on/off`, `#setwelcome <msg>`
6. 🔗 Anti-link protection
7. ⚡ Anti-spam cooldown
8. 📖 `#help` — categorized command list
9. Persistent per-group settings (stored in `/data/settings.json`)

---

## **2️⃣ Local Installation**

```bash
# 1. Clone the repo
git clone https://github.com/YOUR-USERNAME/md-whatsapp-bot.git

# 2. Go to project folder
cd md-whatsapp-bot

# 3. Install dependencies
npm install

# 4. Copy environment variables
cp .env.example .env

# 5. Start the bot locally
npm start

> Scan the QR code in terminal to link your WhatsApp number.




---

3️⃣ Deploy on Fly.io

Step 3.1 — Install Fly CLI

# macOS
brew install superfly/tap/flyctl

# Linux
curl -L https://fly.io/install.sh | sh

# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex

Login:

flyctl auth login


---

Step 3.2 — Initialize App

cd md-whatsapp-bot
flyctl launch

Choose app name (or leave blank for auto-name)

Select nearest region

Choose Node.js runtime

Do not deploy yet if prompted



---

Step 3.3 — Configure Persistent Storage (Optional but Recommended)

# Create volume for WhatsApp session & data
flyctl volumes create md-bot-data --size 1

Add to fly.toml:

[mounts]
  source="md-bot-data"
  destination="/app/data"


---

Step 3.4 — Deploy Bot

flyctl deploy

Fly builds Node.js Docker image and deploys automatically.

Check logs to see the QR code:


flyctl logs

Scan QR code with your WhatsApp number to pair the bot.



---

Step 3.5 — Manage Bot

# Check bot status
flyctl status

# Restart bot
flyctl restart

# View real-time logs
flyctl logs


---

4️⃣ Environment Variables (.env)

PREFIX=#
OWNER_NUMBER=2348012345678
BOT_NAME=MD Bot


---

5️⃣ Folder Structure

md-bot/
│── package.json
│── .gitignore
│── .env.example
│── README.md
│
└── src/
    │── index.js
    │── handler.js
    │
    ├── utils/
    │   ├── config.js
    │   ├── store.js
    │   ├── spamGuard.js
    │   └── moderation.js
    │
    └── commands/
        ├── help.js
        ├── fun.js
        ├── media.js
        ├── admin.js
        ├── welcome.js


---

6️⃣ Notes & Tips

1. WhatsApp does not allow third-party clients to delete messages, so anti-link will warn and kick users if the bot is admin.


2. Ensure the bot has admin rights in groups for moderation commands.


3. Persistent storage is mandatory on Fly.io to avoid rescanning the QR code every restart.


4. Fly.io keeps your bot running 24/7 globally.


5. Only one WhatsApp number can pair per bot instance.




---

