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

const Stats = mongoose.model('Stats', statsSchema);

module.exports = {
  async addMessage(guildId, userId, username) {
    try {
      await Stats.findOneAndUpdate(
        { guild_id: guildId, user_id: userId },
        { $inc: { messages: 1 }, $set: { username } },
        { upsert: true, new: true }
      );
      console.log(`✅ Message counted for ${username}`);
    } catch (err) {
      console.error('❌ addMessage error:', err);
    }
  },
  async addVoiceTime(guildId, userId, username, minutes) {
    await Stats.findOneAndUpdate(
      { guild_id: guildId, user_id: userId },
      { $inc: { voice_minutes: minutes }, $set: { username } },
      { upsert: true }
    );
  },
  async getTopMessages(guildId) {
    return await Stats.find({ guild_id: guildId }).sort({ messages: -1 }).limit(5);
  },
  async getTopVoice(guildId) {
    return await Stats.find({ guild_id: guildId }).sort({ voice_minutes: -1 }).limit(5);
  },
  async getUserStats(guildId, userId) {
    return await Stats.findOne({ guild_id: guildId, user_id: userId });
  },
  async resetStats(guildId) {
    await Stats.deleteMany({ guild_id: guildId });
  }
};