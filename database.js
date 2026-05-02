const fs = require('fs');
const path = require('path');
const DB_FILE = path.join('/tmp', 'stats.json');

function load() {
  try {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {}
  return {};
}

function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data));
}

function getUser(data, guildId, userId, username) {
  if (!data[guildId]) data[guildId] = {};
  if (!data[guildId][userId]) data[guildId][userId] = { username, messages: 0, voice_minutes: 0 };
  data[guildId][userId].username = username;
  return data[guildId][userId];
}

module.exports = {
  addMessage(guildId, userId, username) {
    const data = load();
    getUser(data, guildId, userId, username).messages += 1;
    save(data);
  },
  addVoiceTime(guildId, userId, username, minutes) {
    const data = load();
    getUser(data, guildId, userId, username).voice_minutes += minutes;
    save(data);
  },
  getTopMessages(guildId) {
    const data = load();
    if (!data[guildId]) return [];
    return Object.values(data[guildId]).sort((a, b) => b.messages - a.messages).slice(0, 5);
  },
  getTopVoice(guildId) {
    const data = load();
    if (!data[guildId]) return [];
    return Object.values(data[guildId]).sort((a, b) => b.voice_minutes - a.voice_minutes).slice(0, 5);
  },
  getUserStats(guildId, userId) {
    const data = load();
    return data[guildId]?.[userId] || null;
  },
  resetStats(guildId) {
    const data = load();
    data[guildId] = {};
    save(data);
  }
};