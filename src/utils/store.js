// Simple in-memory database for welcome messages
const welcomes = {};

function setWelcomeMessage(groupId, message) {
  welcomes[groupId] = message;
}

function getWelcomeMessage(groupId) {
  return welcomes[groupId] || null;
}

function disableWelcomeMessage(groupId) {
  delete welcomes[groupId];
}

module.exports = { setWelcomeMessage, getWelcomeMessage, disableWelcomeMessage };
