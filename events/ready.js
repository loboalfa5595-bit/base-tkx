const { Events, ActivityType } = require('discord.js');
const { initGuild } = require('../database');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    console.log('\n========================================');
    console.log(`  Logado como ${client.user.tag}!`);
    console.log(`  ID: ${client.user.id}`);
    console.log('========================================\n');

    const guildList = [];
    for (const guild of client.guilds.cache.values()) {
      initGuild(guild.id);
      guildList.push(`  • ${guild.name} (${guild.memberCount} membros) — ID: ${guild.id}`);
    }

    console.log(`📋 Servidores conectados (${guildList.length}):`);
    if (guildList.length) console.log(guildList.join('\n'));
    console.log('\n----------------------------------------');
    console.log(`✅ ${client.commands.size} comandos carregados`);
    console.log('Use /ajuda para ver todos os comandos');
    console.log('----------------------------------------\n');

    const activities = [
      { name: '/ai para conversar com IA', type: ActivityType.Playing },
      { name: '/admin para gerenciar o servidor', type: ActivityType.Watching },
      { name: `${client.guilds.cache.size} servidores`, type: ActivityType.Competing },
    ];
    let idx = 0;

    client.user.setPresence({ activities: [activities[0]], status: 'online' });
    setInterval(() => {
      idx = (idx + 1) % activities.length;
      client.user.setPresence({ activities: [activities[idx]], status: 'online' });
    }, 30_000);
  },
};
