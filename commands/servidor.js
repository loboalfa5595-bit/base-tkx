const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('servidor')
    .setDescription('Gerenciar configurações do servidor (ADM)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) =>
      s
        .setName('renomear')
        .setDescription('Mudar o nome do servidor')
        .addStringOption((o) =>
          o.setName('nome').setDescription('Novo nome do servidor').setRequired(true).setMaxLength(100)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('icone')
        .setDescription('Mudar o ícone do servidor (URL da imagem)')
        .addStringOption((o) =>
          o.setName('url').setDescription('URL direta da imagem (PNG/JPG/GIF)').setRequired(true)
        )
    )
    .addSubcommand((s) => s.setName('info').setDescription('Mostrar informações do servidor'))
    .addSubcommand((s) =>
      s
        .setName('banner')
        .setDescription('Mudar o banner do servidor (URL) — requer Nível 2+')
        .addStringOption((o) =>
          o.setName('url').setDescription('URL direta da imagem do banner').setRequired(true)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('descricao')
        .setDescription('Definir a descrição do servidor')
        .addStringOption((o) =>
          o.setName('texto').setDescription('Nova descrição').setRequired(true).setMaxLength(120)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: '❌ Você precisa ser **Administrador** para usar este comando.', ephemeral: true });
    }

    if (sub === 'info') {
      const owner = await guild.fetchOwner().catch(() => null);
      const channels = guild.channels.cache;
      const texto = channels.filter((c) => c.type === 0).size;
      const voz = channels.filter((c) => c.type === 2).size;
      const categ = channels.filter((c) => c.type === 4).size;
      const cargos = guild.roles.cache.size - 1;
      const bots = guild.members.cache.filter((m) => m.user.bot).size;
      const humanos = guild.memberCount - bots;

      const embed = new EmbedBuilder()
        .setTitle(`📊 ${guild.name}`)
        .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }))
        .setColor('#e74c3c')
        .addFields(
          { name: '🆔 ID', value: `\`${guild.id}\``, inline: true },
          { name: '👑 Dono', value: owner ? `${owner.user}` : 'Desconhecido', inline: true },
          { name: '📅 Criado em', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
          { name: '\n', value: '\n' },
          { name: '👥 Membros', value: `**${guild.memberCount}** (${humanos} humanos / ${bots} bots)`, inline: true },
          { name: '🏷️ Cargos', value: `${cargos}`, inline: true },
          { name: '\n', value: '\n' },
          { name: '💬 Canais de Texto', value: `${texto}`, inline: true },
          { name: '🔊 Canais de Voz', value: `${voz}`, inline: true },
          { name: '📁 Categorias', value: `${categ}`, inline: true }
        )
        .setFooter({ text: `Nível de Boost: ${guild.premiumTier} • Boosts: ${guild.premiumSubscriptionCount || 0}` })
        .setTimestamp();

      if (guild.banner) embed.setImage(guild.bannerURL({ size: 1024 }));
      if (guild.description) embed.setDescription(guild.description);

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'renomear') {
      const nome = interaction.options.getString('nome');
      const antigo = guild.name;
      try {
        await guild.setName(nome, `Comando /servidor renomear por ${interaction.user.tag}`);
        return interaction.reply({
          content: `✅ Nome do servidor alterado com sucesso!\n**Antes:** \`${antigo}\`\n**Depois:** \`${nome}\``,
          ephemeral: false,
        });
      } catch (e) {
        return interaction.reply({
          content: `❌ Erro ao renomear: ${e.message}`,
          ephemeral: true,
        });
      }
    }

    if (sub === 'icone') {
      const url = interaction.options.getString('url');
      try {
        await guild.setIcon(url, `Comando /servidor icone por ${interaction.user.tag}`);
        return interaction.reply({
          content: `✅ Ícone do servidor atualizado com sucesso!`,
          ephemeral: false,
        });
      } catch (e) {
        return interaction.reply({
          content: `❌ Erro ao mudar ícone. Verifique se a URL é válida (direta, formato PNG/JPG/GIF).\nDetalhes: ${e.message}`,
          ephemeral: true,
        });
      }
    }

    if (sub === 'banner') {
      const url = interaction.options.getString('url');
      if (guild.premiumTier < 2) {
        return interaction.reply({
          content: `❌ O servidor precisa ser **Nível 2** ou superior para ter banner. Nível atual: ${guild.premiumTier}`,
          ephemeral: true,
        });
      }
      try {
        await guild.setBanner(url, `Comando /servidor banner por ${interaction.user.tag}`);
        return interaction.reply({
          content: `✅ Banner do servidor atualizado com sucesso!`,
          ephemeral: false,
        });
      } catch (e) {
        return interaction.reply({
          content: `❌ Erro ao mudar banner: ${e.message}`,
          ephemeral: true,
        });
      }
    }

    if (sub === 'descricao') {
      const texto = interaction.options.getString('texto');
      try {
        await guild.setDescription(texto, `Comando /servidor descricao por ${interaction.user.tag}`);
        return interaction.reply({
          content: `✅ Descrição atualizada!\n\`\`\`${texto}\`\`\``,
          ephemeral: false,
        });
      } catch (e) {
        return interaction.reply({
          content: `❌ Erro: ${e.message}`,
          ephemeral: true,
        });
      }
    }
  },
};
