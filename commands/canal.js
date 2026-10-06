const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} = require('discord.js');

const TIPOS_CANAIS = {
  texto: ChannelType.GuildText,
  voz: ChannelType.GuildVoice,
  noticias: ChannelType.GuildAnnouncement,
  palco: ChannelType.GuildStageVoice,
  forum: ChannelType.GuildForum,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('canal')
    .setDescription('Gerenciar canais e categorias do servidor (ADM)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addSubcommandGroup((g) =>
      g
        .setName('criar')
        .setDescription('Criar novos canais ou categorias')
        .addSubcommand((s) =>
          s
            .setName('texto')
            .setDescription('Criar um canal de texto')
            .addStringOption((o) => o.setName('nome').setDescription('Nome do canal').setRequired(true))
            .addChannelOption((o) => o.setName('categoria').setDescription('Categoria pai (opcional)'))
            .addStringOption((o) => o.setName('topico').setDescription('Tópico/descrição do canal (opcional)').setMaxLength(1024))
            .addBooleanOption((o) => o.setName('nsfw').setDescription('Canal NSFW? (padrão: não)'))
        )
        .addSubcommand((s) =>
          s
            .setName('voz')
            .setDescription('Criar um canal de voz')
            .addStringOption((o) => o.setName('nome').setDescription('Nome do canal').setRequired(true))
            .addChannelOption((o) => o.setName('categoria').setDescription('Categoria pai (opcional)'))
            .addIntegerOption((o) => o.setName('limite').setDescription('Limite de usuários (0 = ilimitado)').setMinValue(0).setMaxValue(99))
            .addIntegerOption((o) => o.setName('bitrate').setDescription('Qualidade de áudio em kbps (padrão 64)').setMinValue(8).setMaxValue(384))
        )
        .addSubcommand((s) =>
          s
            .setName('categoria')
            .setDescription('Criar uma nova categoria')
            .addStringOption((o) => o.setName('nome').setDescription('Nome da categoria').setRequired(true))
        )
        .addSubcommand((s) =>
          s
            .setName('noticias')
            .setDescription('Criar um canal de anúncios/notícias (requer comunidade)')
            .addStringOption((o) => o.setName('nome').setDescription('Nome do canal').setRequired(true))
            .addChannelOption((o) => o.setName('categoria').setDescription('Categoria pai (opcional)'))
        )
        .addSubcommand((s) =>
          s
            .setName('forum')
            .setDescription('Criar um canal de fórum')
            .addStringOption((o) => o.setName('nome').setDescription('Nome do canal').setRequired(true))
            .addChannelOption((o) => o.setName('categoria').setDescription('Categoria pai (opcional)'))
        )
    )
    .addSubcommandGroup((g) =>
      g
        .setName('editar')
        .setDescription('Editar canais existentes')
        .addSubcommand((s) =>
          s
            .setName('nome')
            .setDescription('Renomear um canal ou categoria')
            .addChannelOption((o) => o.setName('canal').setDescription('Canal/categoria').setRequired(true))
            .addStringOption((o) => o.setName('novo_nome').setDescription('Novo nome').setRequired(true))
        )
        .addSubcommand((s) =>
          s
            .setName('mover')
            .setDescription('Mover um canal para outra categoria')
            .addChannelOption((o) => o.setName('canal').setDescription('Canal a mover').setRequired(true))
            .addChannelOption((o) => o.setName('categoria').setDescription('Categoria de destino (deixe vazio para remover)'))
            .addIntegerOption((o) => o.setName('posicao').setDescription('Posição na categoria (0 = primeiro)').setMinValue(0))
        )
    )
    .addSubcommand((s) =>
      s
        .setName('deletar')
        .setDescription('Excluir um canal ou categoria')
        .addChannelOption((o) => o.setName('canal').setDescription('Canal/categoria a ser excluído').setRequired(true))
        .addStringOption((o) => o.setName('motivo').setDescription('Motivo da exclusão (opcional)'))
    )
    .addSubcommand((s) =>
      s
        .setName('listar')
        .setDescription('Listar todos os canais do servidor organizados')
    ),

  async execute(interaction) {
    const grupo = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ content: '❌ Você precisa da permissão **Gerenciar Canais**.', ephemeral: true });
    }

    if (sub === 'listar') {
      const categorias = guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).sort((a, b) => a.position - b.position);
      const semCategoria = guild.channels.cache.filter((c) => !c.parent && c.type !== ChannelType.GuildCategory);

      let texto = '';
      for (const cat of categorias.values()) {
        texto += `\n📁 **${cat.name}**\n`;
        const children = cat.children.cache.sort((a, b) => a.position - b.position);
        for (const ch of children.values()) {
          const icon = ch.type === ChannelType.GuildText ? '💬' : ch.type === ChannelType.GuildVoice ? '🔊' : ch.type === ChannelType.GuildAnnouncement ? '📢' : ch.type === ChannelType.GuildForum ? '📰' : '🔸';
          texto += `   ${icon} ${ch.name} (\`${ch.id}\`)\n`;
        }
      }
      if (semCategoria.size) {
        texto += `\n📁 **Sem Categoria**\n`;
        for (const ch of semCategoria.sort((a, b) => a.position - b.position).values()) {
          const icon = ch.type === ChannelType.GuildText ? '💬' : ch.type === ChannelType.GuildVoice ? '🔊' : '🔸';
          texto += `   ${icon} ${ch.name} (\`${ch.id}\`)\n`;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle(`🗂️ Canais de "${guild.name}"`)
        .setColor('#e74c3c')
        .setDescription(texto || 'Nenhum canal encontrado.')
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'deletar') {
      const canal = interaction.options.getChannel('canal');
      const motivo = interaction.options.getString('motivo') || 'Sem motivo informado';
      const nome = canal.name;
      try {
        await canal.delete(`Excluído por ${interaction.user.tag}: ${motivo}`);
        return interaction.reply({
          content: `🗑️ Canal **${nome}** foi excluído com sucesso.\n**Motivo:** ${motivo}`,
          ephemeral: false,
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Erro: ${e.message}`, ephemeral: true });
      }
    }

    if (grupo === 'criar') {
      const nome = interaction.options.getString('nome');
      const categoriaOption = interaction.options.getChannel('categoria');
      const parent = categoriaOption && categoriaOption.type === ChannelType.GuildCategory ? categoriaOption : null;

      if (sub === 'categoria') {
        try {
          const cat = await guild.channels.create({
            name: nome,
            type: ChannelType.GuildCategory,
            reason: `Criado por ${interaction.user.tag} via comando`,
          });
          return interaction.reply({
            content: `📁 Categoria **${cat.name}** criada com sucesso!\nID: \`${cat.id}\``,
            ephemeral: false,
          });
        } catch (e) {
          return interaction.reply({ content: `❌ Erro: ${e.message}`, ephemeral: true });
        }
      }

      const tipoMap = {
        texto: ChannelType.GuildText,
        voz: ChannelType.GuildVoice,
        noticias: ChannelType.GuildAnnouncement,
        forum: ChannelType.GuildForum,
      };

      const tipo = tipoMap[sub];
      if (!tipo) return interaction.reply({ content: 'Tipo inválido.', ephemeral: true });

      const opts = {
        name: nome,
        type: tipo,
        reason: `Criado por ${interaction.user.tag} via comando`,
      };
      if (parent) opts.parent = parent.id;

      if (sub === 'texto') {
        const topico = interaction.options.getString('topico');
        const nsfw = interaction.options.getBoolean('nsfw') || false;
        if (topico) opts.topic = topico;
        opts.nsfw = nsfw;
      }
      if (sub === 'voz') {
        const limite = interaction.options.getInteger('limite');
        const bitrate = interaction.options.getInteger('bitrate');
        if (limite !== null && limite !== undefined) opts.userLimit = limite;
        if (bitrate) opts.bitrate = bitrate * 1000;
      }

      try {
        const ch = await guild.channels.create(opts);
        const icon = sub === 'texto' ? '💬' : sub === 'voz' ? '🔊' : sub === 'noticias' ? '📢' : '📰';
        return interaction.reply({
          content: `${icon} Canal **${ch.name}** criado com sucesso!${parent ? ` na categoria **${parent.name}**` : ''}\nID: \`${ch.id}\``,
          ephemeral: false,
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Erro ao criar canal: ${e.message}`, ephemeral: true });
      }
    }

    if (grupo === 'editar') {
      const canal = interaction.options.getChannel('canal');
      if (sub === 'nome') {
        const novo = interaction.options.getString('novo_nome');
        const antigo = canal.name;
        try {
          await canal.setName(novo, `Renomeado por ${interaction.user.tag}`);
          return interaction.reply({
            content: `✅ Renomeado: \`${antigo}\` → \`${novo}\``,
            ephemeral: false,
          });
        } catch (e) {
          return interaction.reply({ content: `❌ Erro: ${e.message}`, ephemeral: true });
        }
      }
      if (sub === 'mover') {
        const categoria = interaction.options.getChannel('categoria');
        const posicao = interaction.options.getInteger('posicao');
        try {
          const edits = {};
          if (categoria && categoria.type === ChannelType.GuildCategory) edits.parent = categoria.id;
          else if (categoria === null) edits.parent = null;
          if (posicao !== null && posicao !== undefined) edits.position = posicao;
          await canal.edit(edits, `Movido por ${interaction.user.tag}`);
          return interaction.reply({
            content: `✅ Canal **${canal.name}** movido com sucesso!${categoria ? ` Para: **${categoria.name}**` : ''}${posicao !== null && posicao !== undefined ? ` (Posição: ${posicao})` : ''}`,
            ephemeral: false,
          });
        } catch (e) {
          return interaction.reply({ content: `❌ Erro: ${e.message}`, ephemeral: true });
        }
      }
    }
  },
};
