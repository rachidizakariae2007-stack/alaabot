const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URL).then(() => {
  console.log('✅ Connected to MongoDB!');
}).catch(err => console.error('MongoDB error:', err));

const statsSchema = new mongoose.Schema({
  guild_id: String,
  user_id: String,
  username: String,
  messages: { type: Number, default: 0 },
  voice_minutes: { type: Number, default: 0 }
});

const jailSchema = new mongoose.Schema({
  guild_id: String,
  user_id: String,
  username: String,
  reason: String,
  release_time: Number,
  jailed_at: { type: Number, default: Date.now }
});

const jailHistorySchema = new mongoose.Schema({
  guild_id: String,
  user_id: String,
  username: String,
  reason: String,
  jailed_at: { type: Number, default: Date.now }
});

const Stats = mongoose.model('Stats', statsSchema);
const Jail = mongoose.model('Jail', jailSchema);
const JailHistory = mongoose.model('JailHistory', jailHistorySchema);

module.exports = {
  async addMessage(guildId, userId, username) {
    try {
      await Stats.findOneAndUpdate(
        { guild_id: guildId, user_id: userId },
        { $inc: { messages: 1 }, $set: { username } },
        { upsert: true, returnDocument: 'after' }
      );
    } catch (err) { console.error('❌ addMessage error:', err); }
  },
  async addVoiceTime(guildId, userId, username, minutes) {
    try {
      await Stats.findOneAndUpdate(
        { guild_id: guildId, user_id: userId },
        { $inc: { voice_minutes: minutes }, $set: { username } },
        { upsert: true, returnDocument: 'after' }
      );
    } catch (err) { console.error('❌ addVoiceTime error:', err); }
  },
  async getTopMessages(guildId) {
    try {
      return await Stats.find({ guild_id: guildId, messages: { $gt: 0 } }).sort({ messages: -1 }).limit(5).lean();
    } catch { return []; }
  },
  async getTopVoice(guildId) {
    try {
      return await Stats.find({ guild_id: guildId, voice_minutes: { $gt: 0 } }).sort({ voice_minutes: -1 }).limit(5).lean();
    } catch { return []; }
  },
  async getUserStats(guildId, userId) {
    try {
      return await Stats.findOne({ guild_id: guildId, user_id: userId }).lean();
    } catch { return null; }
  },
  async resetStats(guildId) {
    try {
      await Stats.deleteMany({ guild_id: guildId });
    } catch (err) { console.error('❌ resetStats error:', err); }
  },
  async addJail(guildId, userId, username, reason, releaseTime) {
    await Jail.findOneAndUpdate(
      { guild_id: guildId, user_id: userId },
      { guild_id: guildId, user_id: userId, username, reason, release_time: releaseTime, jailed_at: Date.now() },
      { upsert: true }
    );
    await JailHistory.create({ guild_id: guildId, user_id: userId, username, reason, jailed_at: Date.now() });
  },
  async removeJail(guildId, userId) {
    await Jail.deleteOne({ guild_id: guildId, user_id: userId });
  },
  async getExpiredJails(now) {
    return await Jail.find({ release_time: { $lte: now } }).lean();
  },
  async getJailHistory(guildId, userId) {
    return await JailHistory.find({ guild_id: guildId, user_id: userId }).sort({ jailed_at: -1 }).lean();
  }
};