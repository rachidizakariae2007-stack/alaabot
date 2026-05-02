require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder } = require('discord.js');
const db = require('./database');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

const voiceSessions = new Map();

function formatTime(minutes) {
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder().setName('top').setDescription('Show the most active members this week'),
    new SlashCommandBuilder().setName('mystats').setDescription('Check your own activity stats'),
    new SlashCommandBuilder().setName('reset').setDescription('Reset weekly stats (Admin only)'),
  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
  console.log('✅ Slash commands registered!');
}

client.once('ready', () => {
  console.log(`✅ ALAA is online as ${client.user.tag}`);
  registerCommands();
});

client.on('messageCreate', (message) => {
  if (message.author.bot) return;
  db.addMessage(message.guild.id, message.author.id, message.author.username);
});

client.on('voiceStateUpdate', (oldState, newState) => {
  const userId = newState.id;
  const guildId = newState.guild.id;
  const username = newState.member?.user?.username || 'Unknown';
  const key = `${guildId}:${userId}`;

  if (!oldState.channelId && newState.channelId) {
    voiceSessions.set(key, Date.now());
  }

  if (oldState.channelId && !newState.channelId) {
    const joinTime = voiceSessions.get(key);
    if (joinTime) {
      const minutes = Math.floor((Date.now() - joinTime) / 60000);
      if (minutes > 0) db.addVoiceTime(guildId, userId, username, minutes);
      voiceSessions.delete(key);
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'top') {
    const topMessages = await db.getTopMessages(interaction.guild.id);
    const topVoice = await db.getTopVoice(interaction.guild.id);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🏆 NEXUS — Weekly Activity Report')
      .addFields(
        { name: '💬 Top Message Senders', value: topMessages.length ? topMessages.map((u, i) => `**${i+1}.** ${u.username} — ${u.messages} messages`).join('\n') : 'No data yet.' },
        { name: '🎙️ Top Voice Members', value: topVoice.length ? topVoice.map((u, i) => `**${i+1}.** ${u.username} — ${formatTime(u.voice_minutes)}`).join('\n') : 'No data yet.' }
      )
      .setFooter({ text: 'NEXUS Bot' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'mystats') {
    const stats = await db.getUserStats(interaction.guild.id, interaction.user.id);
    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle(`📊 ${interaction.user.username}'s Stats`)
      .addFields(
        { name: '💬 Messages', value: `${stats?.messages || 0}`, inline: true },
        { name: '🎙️ Voice Time', value: formatTime(stats?.voice_minutes || 0), inline: true }
      );
    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'mystats') {
    const stats = db.getUserStats(interaction.guild.id, interaction.user.id);
    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle(`📊 ${interaction.user.username}'s Stats`)
      .addFields(
        { name: '💬 Messages', value: `${stats?.messages || 0}`, inline: true },
        { name: '🎙️ Voice Time', value: formatTime(stats?.voice_minutes || 0), inline: true }
      );
    await interaction.reply({ embeds: [embed] });
  }

  if (interaction.commandName === 'reset') {
    if (!interaction.member.permissions.has('Administrator'))
      return interaction.reply({ content: '❌ Admins only!', ephemeral: true });
    db.resetStats(interaction.guild.id);
    await interaction.reply('🔄 Stats reset!');
  }
});

client.login(process.env.TOKEN);