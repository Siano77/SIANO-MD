// index.js

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason
} from "@whiskeysockets/baileys";
import TelegramBot from "node-telegram-bot-api";
import qrcode from "qrcode";
import fs from "fs";
import path from "path";

// 🔑 Telegram bot token from BotFather (set in .env)
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// 🟢 Active WhatsApp sessions stored by telegramId
const sessions = {};

/**
 * Start or restore a WhatsApp session for a Telegram user
 */
async function startSession(telegramId, chatId) {
  try {
    const authDir = `./auth_info/${telegramId}`;
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false
    });

    // 📌 Handle WhatsApp connection updates
    sock.ev.on("connection.update", async (update) => {
      const { connection, qr, lastDisconnect } = update;

      if (qr) {
        // Save QR code as image and send to Telegram
        const qrImagePath = path.join(authDir, "qr.png");
        await qrcode.toFile(qrImagePath, qr);
        await bot.sendPhoto(chatId, qrImagePath, {
          caption: "📌 Scan this QR with WhatsApp to pair your account."
        });
      }

      if (connection === "close") {
        const shouldReconnect =
          lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
          console.log(`🔄 Reconnecting WhatsApp for ${telegramId}...`);
          startSession(telegramId, chatId);
        } else {
          bot.sendMessage(
            chatId,
            "⚠️ WhatsApp session ended. Please run /pair again."
          );
          delete sessions[telegramId];
        }
      } else if (connection === "open") {
        bot.sendMessage(chatId, "✅ WhatsApp connected successfully!");
      }
    });

    // Save new credentials if they update
    sock.ev.on("creds.update", saveCreds);

    // Store session reference
    sessions[telegramId] = sock;
  } catch (err) {
    console.error("❌ Error starting session:", err);
    bot.sendMessage(chatId, "❌ Failed to start WhatsApp session.");
  }
}

// 📌 Telegram command: /pair
bot.onText(/\/pair/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id.toString();

  if (sessions[telegramId]) {
    bot.sendMessage(
      chatId,
      "✅ You already have an active WhatsApp session. No need to pair again."
    );
    return;
  }

  bot.sendMessage(
    chatId,
    "📌 Please wait, your WhatsApp QR code will be sent shortly..."
  );
  await startSession(telegramId, chatId);
});

// 📌 Optional: Telegram command to logout
bot.onText(/\/logout/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id.toString();

  if (!sessions[telegramId]) {
    bot.sendMessage(chatId, "⚠️ You don’t have an active WhatsApp session.");
    return;
  }

  try {
    await sessions[telegramId].logout();
    delete sessions[telegramId];
    bot.sendMessage(chatId, "✅ Logged out successfully. Run /pair to connect again.");
  } catch (err) {
    console.error("❌ Logout error:", err);
    bot.sendMessage(chatId, "❌ Failed to logout your WhatsApp session.");
  }
});
