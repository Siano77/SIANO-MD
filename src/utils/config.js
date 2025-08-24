require("dotenv").config();

module.exports = {
  PREFIX: "#",
  BOT_NAME: process.env.BOT_NAME || "MD Bot",
  OWNER_NUMBER: process.env.OWNER_NUMBER || "1234567890@s.whatsapp.net",
};
