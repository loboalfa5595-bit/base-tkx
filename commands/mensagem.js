const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mensagem')
    .setDescription('Enviar ou gerenciar mensagens (ADM)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((s) =>
      s
        .setName('enviar')
        .setDescription('Enviar uma mensagem em nome do bot para um canal')
        .addChannelOption((o) =>
          o.setName('canal').setDescription('Canal onde a mensagem será enviada').setRequired(true)
        )
        .addStringOption((o) =>
          o.setName('texto').setDescription('Conteúdo da mensagem (use \\n para quebras de linha)').setRequired(true).setMaxLength(2000)
        )
        .addAttachmentOption((o) =>
          o.setName('arquivo').setDescription('Anexar arquivo/imagem (opcional)')
        )
    )
    .addSubcommand((s) =>
      s
        .setName('embed')
        .setDescription('Enviar uma mensagem em embed personalizado')
        .addChannelOption((o) => o.setName('canal').setDescription('Canal alvo').setRequired(true))
        .addStringOption((o) => o.setName('titulo').setDescription('Título do embed').setRequired(true).setMaxLength(256))
        .addStringOption((o) => o.setName('descricao').setDescription('Descrição do embed').setRequired(true).setMaxLength(4000))
        .addStringOption((o) => o.setName('cor').setDescription('Cor hex (ex: #ff0000 ou vermelho)').addChoices(
          { name: 'Vermelho', value: '#e74c3c' },
          { name: 'Verde', value: '#2ecc71' },
          { name: 'Azul', value: '#3498db' },
          { name: 'Amarelo', value: '#f1c40f' },
          { name: 'Roxo', value: '#9b59b6' },
          { name: 'Preto', value: '#2c3e50' },
          { name: 'Neon (personalizado)', value: '#ff0040' }
        ))
        .addStringOption((o) => o.setName('rodape').setDescription('Texto do rodapé').setMaxLength(2048))
        .addStringOption((o) => o.setName('thumbnail').setDescription('URL da miniatura (imagem pequena)'))
        .addStringOption((o) => o.setName('imagem').setDescription('URL da imagem grande'))
        .addBooleanOption((o) => o.setName('timestamp').setDescription('Mostrar data/hora no rodapé?'))
    )
    .addSubcommand((s) =>
      s
        .setName('limpar')
        .setDescription('Apagar múltiplas mensagens de um canal (0-100)')
        .addIntegerOption((o) => o.setName('quantidade').setDescription('Quantas mensagens apagar (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
        .addChannelOption((o) => o.setName('canal').setDescription('Canal para limpar (padrão: atual)'))
        .addUserOption((o) => o.setName('usuario').setDescription('Apagar apenas mensagens de um usuário específico'))
    )
    .addSubcommand((s) =>
      s
        .setName('editar')
        .setDescription('Editar uma mensagem que o bot enviou')
        .addChannelOption((o) => o.setName('canal').setDescription('Canal da mensagem').setRequired(true))
        .addStringOption((o) => o.setName('mensagem_id').setDescription('ID da mensagem do bot').setRequired(true))
        .addStringOption((o) => o.setName('novo_texto').setDescription('Novo conteúdo').setRequired(true).setMaxLength(2000))
    )
    .addSubcommand((s) =>
      s
        .setName('dm')
        .setDescription('Enviar mensagem direta para um usuário via bot')
        .addUserOption((o) => o.setName('usuario').setDescription('Usuário destinatário').setRequired(true))
        .addStringOption((o) => o.setName('texto').setDescription('Conteúdo da DM').setRequired(true).setMaxLength(2000))
        .addBooleanOption((o) => o.setName('anonimo').setDescription('Não mostrar quem enviou (padrão: sim)'))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const podeGerenciar = interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);

    if (sub === 'limpar') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return interaction.reply({ content: '❌ Você precisa de **Gerenciar Mensagens**.', ephemeral: true });
      }
      let canal = interaction.options.getChannel('canal');
      if (!canal) canal = interaction.channel;
      if (!canal || (canal.type !== ChannelType.GuildText && canal.type !== ChannelType.GuildAnnouncement)) {
        return interaction.reply({ content: '❌ Este comando só funciona em canais de texto/anúncios.', ephemeral: true });
      }
      const qtd = interaction.options.getInteger('quantidade');
      const usuario = interaction.options.getUser('usuario');

      await interaction.deferReply({ ephemeral: true });

      try {
        let msgs = await canal.messages.fetch({ limit: Math.min(qtd + 1, 100) });
        msgs = msgs.filter((m) => Date.now() - m.createdTimestamp < 14 * 24 * 60 * 60 * 1000);
        if (usuario) msgs = msgs.filter((m) => m.author.id === usuario.id);
        msgs = msgs.first(qtd);
        if (!msgs.length) return interaction.editReply('❌ Nenhuma mensagem elegível encontrada (são aceitas apenas msgs com até 14 dias).');
        const deletadas = await canal.bulkDelete(msgs, true);
        return interaction.editReply(`🧹 Apagadas **${deletadas.size}** mensagens${usuario ? ` de ${usuario}` : ''} em ${canal}.`);
      } catch (e) {
        return interaction.editReply(`❌ Erro: ${e.message}`);
      }
    }

    if (sub === 'enviar') {
      if (!podeGerenciar) return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });
      const canal = interaction.options.getChannel('canal');
      const texto = interaction.options.getString('texto').replace(/\\n/g, '\n');
      const arquivo = interaction.options.getAttachment('arquivo');
      if (!canal.isTextBased()) return interaction.reply({ content: '❌ O canal escolhido não é de texto.', ephemeral: true });
      try {
        const payload = { content: texto };
        if (arquivo) payload.files = [arquivo];
        const msg = await canal.send(payload);
        return interaction.reply({
          content: `✅ Mensagem enviada para ${canal}! [Ver mensagem](${msg.url})`,
          ephemeral: true,
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Erro: ${e.message}`, ephemeral: true });
      }
    }

    if (sub === 'embed') {
      if (!podeGerenciar) return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });
      const canal = interaction.options.getChannel('canal');
      if (!canal.isTextBased()) return interaction.reply({ content: '❌ Canal inválido.', ephemeral: true });
      const titulo = interaction.options.getString('titulo');
      const desc = interaction.options.getString('descricao').replace(/\\n/g, '\n');
      const cor = interaction.options.getString('cor') || '#ff0040';
      const rodape = interaction.options.getString('rodape');
      const thumb = interaction.options.getString('thumbnail');
      const imagem = interaction.options.getString('imagem');
      const ts = interaction.options.getBoolean('timestamp') || false;

      const embed = new EmbedBuilder().setTitle(titulo).setDescription(desc).setColor(cor);
      if (rodape) embed.setFooter({ text: rodape });
      if (thumb) embed.setThumbnail(thumb);
      if (imagem) embed.setImage(imagem);
      if (ts) embed.setTimestamp();

      try {
        const msg = await canal.send({ embeds: [embed] });
        return interaction.reply({
          content: `✅ Embed enviado! [Ver](${msg.url})`,
          ephemeral: true,
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Erro: ${e.message}`, ephemeral: true });
      }
    }

    if (sub === 'editar') {
      if (!podeGerenciar) return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });
      const canal = interaction.options.getChannel('canal');
      const msgId = interaction.options.getString('mensagem_id');
      const novo = interaction.options.getString('novo_texto').replace(/\\n/g, '\n');
      if (!canal.isTextBased()) return interaction.reply({ content: '❌ Canal inválido.', ephemeral: true });
      try {
        const msg = await canal.messages.fetch(msgId);
        if (msg.author.id !== interaction.client.user.id) {
          return interaction.reply({ content: '❌ Só posso editar minhas próprias mensagens.', ephemeral: true });
        }
        await msg.edit({ content: novo });
        return interaction.reply({ content: `✅ Mensagem editada! [Ver](${msg.url})`, ephemeral: true });
      } catch (e) {
        return interaction.reply({ content: `❌ Erro: ${e.message}`, ephemeral: true });
      }
    }

    if (sub === 'dm') {
      if (!podeGerenciar) return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });
      const usuario = interaction.options.getUser('usuario');
      const anon = interaction.options.getBoolean('anonimo') !== false;
      const texto = interaction.options.getString('texto').replace(/\\n/g, '\n');
      try {
        const msgCompleta = anon ? texto : `${texto}\n\n*— Enviado por ${interaction.user.tag} via servidor "${interaction.guild.name}"*`;
        await usuario.send(msgCompleta);
        return interaction.reply({
          content: `📨 DM enviada para **${usuario.tag}**${anon ? ' (anônima)' : ''}.`,
          ephemeral: true,
        });
      } catch (e) {
        return interaction.reply({
          content: `❌ Não foi possível enviar DM: ${e.message}\n(Possivelmente o usuário bloqueou DMs de membros do servidor)`,
          ephemeral: true,
        });
      }
    }
  },
};
