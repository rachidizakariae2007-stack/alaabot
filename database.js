const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('alaa.db');

db.run(`
  CREATE TABLE IF NOT EXISTS stats (
    guild_id TEXT,
    user_id TEXT,
    username TEXT,
    messages INTEGER DEFAULT 0,
    voice_minutes INTEGER DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  )
`);

module.exports = {
  addMessage(guildId, userId, username) {
    db.run(`INSERT INTO stats (guild_id, user_id, username, messages, voice_minutes) VALUES (?, ?, ?, 1, 0) ON CONFLICT(guild_id, user_id) DO UPDATE SET messages = messages + 1, username = ?`,
    [guildId, userId, username, username]);
  },
  addVoiceTime(guildId, userId, username, minutes) {
    db.run(`INSERT INTO stats (guild_id, user_id, username, messages, voice_minutes) VALUES (?, ?, ?, 0, ?) ON CONFLICT(guild_id, user_id) DO UPDATE SET voice_minutes = voice_minutes + ?, username = ?`,
    [guildId, userId, username, minutes, minutes, username]);
  },
  getTopMessages(guildId) {
    return new Promise((resolve) => {
      db.all(`SELECT username, messages FROM stats WHERE guild_id = ? ORDER BY messages DESC LIMIT 5`, [guildId], (err, rows) => {
        resolve(rows || []);
      });
    });
  },
  getTopVoice(guildId) {
    return new Promise((resolve) => {
      db.all(`SELECT username, voice_minutes FROM stats WHERE guild_id = ? ORDER BY voice_minutes DESC LIMIT 5`, [guildId], (err, rows) => {
        resolve(rows || []);
      });
    });
  },
  getUserStats(guildId, userId) {
    return new Promise((resolve) => {
      db.get(`SELECT * FROM stats WHERE guild_id = ? AND user_id = ?`, [guildId, userId], (err, row) => {
        resolve(row || null);
      });
    });
  },
  resetStats(guildId) {
    db.run(`DELETE FROM stats WHERE guild_id = ?`, [guildId]);
  }
};