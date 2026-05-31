require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
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

function parseDuration(str) {
  if (!str) return null;
  const match = str.match(/^(\d+)(m|h|d)$/);
  if (!match) return null;
  const value = parseInt(match[1]);
  const unit = match[2];
  if (unit === 'm') return value * 60 * 1000;
  if (unit === 'h') return value * 60 * 60 * 1000;
  if (unit === 'd') return value * 24 * 60 * 60 * 1000;
  return null;
}

function hasJailPermission(member) {
  const allowedRoles = ['administrator', 'supervisor', 'founder'];
  return member.permissions.has('Administrator') ||
    member.roles.cache.some(r => allowedRoles.includes(r.name.toLowerCase()));
}

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('top')
      .setDescription('Show the most active members this week'),

    new SlashCommandBuilder()
      .setName('mystats')
      .setDescription('Check your own activity stats'),

    new SlashCommandBuilder()
      .setName('reset')
      .setDescription('Reset weekly stats (Admin only)'),

    new SlashCommandBuilder()
      .setName('jail')
      .setDescription('Put a member in jail')
      .addUserOption(option => option.setName('user').setDescription('The user to jail').setRequired(true))
      .addStringOption(option => option.setName('reason').setDescription('Reason for jail').setRequired(true))
      .addStringOption(option => option.setName('period').setDescription('Duration e.g. 1h, 30m, 1d (optional)').setRequired(false)),

    new SlashCommandBuilder()
      .setName('free')
      .setDescription('Free a jailed member')
      .addUserOption(option => option.setName('user').setDescription('The user to free').setRequired(true)),

    new SlashCommandBuilder()
      .setName('jailhistory')
      .setDescription('See jail history of a user')
      .addUserOption(option => option.setName('user').setDescription('The user to check').setRequired(true)),

  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
  console.log('✅ Slash commands registered!');
}

client.once('clientReady', () => {
  console.log(`✅ NEXUS is online as ${client.user.tag}`);
  registerCommands();

  setInterval(async () => {
    const now = Date.now();
    const expired = await db.getExpiredJails(now);
    for (const jail of expired) {
      try {
        const guild = await client.guilds.fetch(jail.guild_id);
        const member = await guild.members.fetch(jail.user_id);
        const jailRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'jail');
        if (jailRole && member.roles.cache.has(jailRole.id)) {
          await member.roles.remove(jailRole);
          await member.send(`✅ تم الإفراج عنك في سيرفر **${guild.name}**! انتهت مدة عقوبتك.`);
        }
        await db.removeJail(jail.guild_id, jail.user_id);
      } catch (err) {
        console.error('Auto-free error:', err);
      }
    }
  }, 60 * 1000);
});

client.on('messageCreate', (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  db.addMessage(message.guild.id, message.author.id, message.author.username);
});

client.on('voiceStateUpdate', (oldState, newState) => {
  const userId = newState.id;
  const guildId = newState.guild.id;
  const username = newState.member?.user?.username || 'Unknown';
  const key = `${guildId}:${userId}`;

  const leftChannel = oldState.channelId && !newState.channelId;
  const joinedChannel = !oldState.channelId && newState.channelId;
  const switchedChannel = oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId;

  if (joinedChannel) {
    if (newState.channel.name.toLowerCase() === 'afk') return;
    voiceSessions.set(key, Date.now());
  }

  if (switchedChannel) {
    const wasAfk = oldState.channel.name.toLowerCase() === 'afk';
    const isAfk = newState.channel.name.toLowerCase() === 'afk';
    if (!wasAfk) {
      const joinTime = voiceSessions.get(key);
      if (joinTime) {
        const minutes = Math.floor((Date.now() - joinTime) / 60000);
        if (minutes > 0) db.addVoiceTime(guildId, userId, username, minutes);
      }
    }
    if (!isAfk) {
      voiceSessions.set(key, Date.now());
    } else {
      voiceSessions.delete(key);
    }
  }

  if (leftChannel) {
    if (oldState.channel.name.toLowerCase() === 'afk') return;
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

  try {
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

    else if (interaction.commandName === 'mystats') {
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

    else if (interaction.commandName === 'reset') {
      if (!interaction.member.permissions.has('Administrator'))
        return interaction.reply({ content: '❌ Admins only!', ephemeral: true });
      db.resetStats(interaction.guild.id);
      await interaction.reply('🔄 Stats reset!');
    }

    else if (interaction.commandName === 'jail') {
      if (!hasJailPermission(interaction.member))
        return interaction.reply({ content: '❌ ما عندكش الصلاحية!', ephemeral: true });

      const target = interaction.options.getMember('user');
      const reason = interaction.options.getString('reason');
      const period = interaction.options.getString('period');

      const duration = period ? parseDuration(period) : null;
      if (period && !duration)
        return interaction.reply({ content: '❌ مدة غير صحيحة! استخدم مثلاً: 30m أو 1h أو 2d', ephemeral: true });

      const jailRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'jail');
      if (!jailRole)
        return interaction.reply({ content: '❌ ما لقيتش رول اسمه "jail"! أنشئه أولاً.', ephemeral: true });

      await target.roles.add(jailRole);

      const releaseTime = duration ? Date.now() + duration : null;
      await db.addJail(interaction.guild.id, target.id, target.user.username, reason, releaseTime);

      try {
        await target.send(`🚨 لقد تم وضعك في السجن في سيرفر **${interaction.guild.name}**!\n📋 **السبب:** ${reason}${period ? `\n⏰ **المدة:** ${period}` : '\n⏰ **المدة:** غير محددة - سيتم الإفراج عنك يدوياً'}`);
      } catch {}

      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🚨 تم السجن')
        .addFields(
          { name: '👤 العضو', value: `${target.user.username}`, inline: true },
          { name: '⏰ المدة', value: period || 'غير محددة', inline: true },
          { name: '📋 السبب', value: reason }
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

    else if (interaction.commandName === 'free') {
      if (!hasJailPermission(interaction.member))
        return interaction.reply({ content: '❌ ما عندكش الصلاحية!', ephemeral: true });

      const target = interaction.options.getMember('user');
      const jailRole = interaction.guild.roles.cache.find(r => r.name.toLowerCase() === 'jail');

      if (!jailRole || !target.roles.cache.has(jailRole.id))
        return interaction.reply({ content: '❌ هذا العضو مش في السجن!', ephemeral: true });

      await target.roles.remove(jailRole);
      await db.removeJail(interaction.guild.id, target.id);

      try {
        await target.send(`✅ تم الإفراج عنك في سيرفر **${interaction.guild.name}**!`);
      } catch {}

      await interaction.reply(`✅ تم الإفراج عن **${target.user.username}**!`);
    }

    else if (interaction.commandName === 'jailhistory') {
      const target = interaction.options.getUser('user');
      const history = await db.getJailHistory(interaction.guild.id, target.id);

      if (!history.length)
        return interaction.reply({ content: `✅ **${target.username}** ما عندوش سوابق.`, ephemeral: true });

      const embed = new EmbedBuilder()
        .setColor(0xFF6600)
        .setTitle(`📋 سوابق السجن — ${target.username}`)
        .setDescription(history.map((h, i) =>
          `**${i+1}.** 📋 ${h.reason} | 📅 ${new Date(h.jailed_at).toLocaleDateString()}`
        ).join('\n'))
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    }

  } catch (err) {
    console.error(err);
  }
});

client.login(process.env.TOKEN);