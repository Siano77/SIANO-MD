// Simple spam guard to block repeated messages
const spamMap = new Map();
const SPAM_LIMIT = 5; // number of repeats
const TIME_FRAME = 10000; // ms (10 seconds)

function isSpam(user, text) {
  const now = Date.now();
  if (!spamMap.has(user)) {
    spamMap.set(user, { lastText: text, count: 1, lastTime: now });
    return false;
  }

  const data = spamMap.get(user);
  if (data.lastText === text && (now - data.lastTime) < TIME_FRAME) {
    data.count++;
    data.lastTime = now;
    if (data.count >= SPAM_LIMIT) {
      spamMap.set(user, { lastText: text, count: 0, lastTime: now });
      return true;
    }
  } else {
    data.lastText = text;
    data.count = 1;
    data.lastTime = now;
  }
  spamMap.set(user, data);
  return false;
}

module.exports = { isSpam };
