const Database = require('better-sqlite3');
const db = new Database('alaa.db');

db.exec(`
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
    db.prepare(`
      INSERT INTO stats (guild_id, user_id, username, messages, voice_minutes)
      VALUES (?, ?, ?, 1, 0)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET messages = messages + 1, username = ?
    `).run(guildId, userId, username, username);
  },
  addVoiceTime(guildId, userId, username, minutes) {
    db.prepare(`
      INSERT INTO stats (guild_id, user_id, username, messages, voice_minutes)
      VALUES (?, ?, ?, 0, ?)
      ON CONFLICT(guild_id, user_id) DO UPDATE SET voice_minutes = voice_minutes + ?, username = ?
    `).run(guildId, userId, username, minutes, minutes, username);
  },
  getTopMessages(guildId) {
    return db.prepare(`SELECT username, messages FROM stats WHERE guild_id = ? ORDER BY messages DESC LIMIT 5`).all(guildId);
  },
  getTopVoice(guildId) {
    return db.prepare(`SELECT username, voice_minutes FROM stats WHERE guild_id = ? ORDER BY voice_minutes DESC LIMIT 5`).all(guildId);
  },
  getUserStats(guildId, userId) {
    return db.prepare(`SELECT * FROM stats WHERE guild_id = ? AND user_id = ?`).get(guildId, userId);
  },
  resetStats(guildId) {
    db.prepare(`DELETE FROM stats WHERE guild_id = ?`).run(guildId);
  }
};