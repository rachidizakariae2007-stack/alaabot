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
        { upsert: true, returnDocument: 'after' }
      );
      console.log(`✅ Message counted for ${username}`);
    } catch (err) {
      console.error('❌ addMessage error:', err);
    }
  },
  async addVoiceTime(guildId, userId, username, minutes) {
    try {
      await Stats.findOneAndUpdate(
        { guild_id: guildId, user_id: userId },
        { $inc: { voice_minutes: minutes }, $set: { username } },
        { upsert: true, returnDocument: 'after' }
      );
      console.log(`✅ Voice time added for ${username}: ${minutes}m`);
    } catch (err) {
      console.error('❌ addVoiceTime error:', err);
    }
  },
  async getTopMessages(guildId) {
    try {
      const results = await Stats.find({ guild_id: guildId, messages: { $gt: 0 } })
        .sort({ messages: -1 })
        .limit(5)
        .lean();
      console.log(`📊 getTopMessages results:`, JSON.stringify(results));
      return results;
    } catch (err) {
      console.error('❌ getTopMessages error:', err);
      return [];
    }
  },
  async getTopVoice(guildId) {
    try {
      const results = await Stats.find({ guild_id: guildId, voice_minutes: { $gt: 0 } })
        .sort({ voice_minutes: -1 })
        .limit(5)
        .lean();
      console.log(`📊 getTopVoice results:`, JSON.stringify(results));
      return results;
    } catch (err) {
      console.error('❌ getTopVoice error:', err);
      return [];
    }
  },
  async getUserStats(guildId, userId) {
    try {
      const result = await Stats.findOne({ guild_id: guildId, user_id: userId }).lean();
      console.log(`📊 getUserStats result:`, JSON.stringify(result));
      return result;
    } catch (err) {
      console.error('❌ getUserStats error:', err);
      return null;
    }
  },
  async resetStats(guildId) {
    try {
      await Stats.deleteMany({ guild_id: guildId });
      console.log(`🔄 Stats reset for guild ${guildId}`);
    } catch (err) {
      console.error('❌ resetStats error:', err);
    }
  }
};