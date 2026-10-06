const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cargo')
    .setDescription('Gerenciar cargos do servidor (ADM)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommandGroup((g) =>
      g
        .setName('criar')
        .setDescription('Criar novos cargos')
        .addSubcommand((s) =>
          s
            .setName('simples')
            .setDescription('Criar um cargo básico rapidamente')
            .addStringOption((o) => o.setName('nome').setDescription('Nome do cargo').setRequired(true).setMaxLength(100))
            .addStringOption((o) =>
              o.setName('cor').setDescription('Cor do cargo (hex ou nome)').addChoices(
                { name: 'Vermelho Neon', value: '#ff0040' },
                { name: 'Vermelho', value: '#e74c3c' },
                { name: 'Laranja', value: '#e67e22' },
                { name: 'Amarelo', value: '#f1c40f' },
                { name: 'Verde', value: '#2ecc71' },
                { name: 'Ciano', value: '#1abc9c' },
                { name: 'Azul', value: '#3498db' },
                { name: 'Roxo', value: '#9b59b6' },
                { name: 'Rosa', value: '#ff69b4' },
                { name: 'Preto', value: '#23272a' },
                { name: 'Branco', value: '#ffffff' },
                { name: 'Aleatório', value: 'RANDOM' }
              )
            )
            .addBooleanOption((o) => o.setName('exibir').setDescription('Exibir separadamente na lista? (padrão: sim)'))
            .addBooleanOption((o) => o.setName('mencionavel').setDescription('Permitir @menção do cargo?'))
        )
    )
    .addSubcommandGroup((g) =>
      g
        .setName('dar')
        .setDescription('Atribuir cargos a membros')
        .addSubcommand((s) =>
          s
            .setName('membro')
            .setDescription('Dar um cargo a um membro específico')
            .addUserOption((o) => o.setName('usuario').setDescription('Membro alvo').setRequired(true))
            .addRoleOption((o) => o.setName('cargo').setDescription('Cargo a conceder').setRequired(true))
        )
        .addSubcommand((s) =>
          s
            .setName('todos')
            .setDescription('Dar um cargo a TODOS os membros (cuidado!)')
            .addRoleOption((o) => o.setName('cargo').setDescription('Cargo a ser dado a todos').setRequired(true))
        )
    )
    .addSubcommandGroup((g) =>
      g
        .setName('remover')
        .setDescription('Retirar cargos de membros')
        .addSubcommand((s) =>
          s
            .setName('membro')
            .setDescription('Retirar cargo de um membro')
            .addUserOption((o) => o.setName('usuario').setDescription('Membro alvo').setRequired(true))
            .addRoleOption((o) => o.setName('cargo').setDescription('Cargo a retirar').setRequired(true))
        )
    )
    .addSubcommand((s) =>
      s
        .setName('deletar')
        .setDescription('Excluir um cargo do servidor')
        .addRoleOption((o) => o.setName('cargo').setDescription('Cargo a ser excluído').setRequired(true))
        .addStringOption((o) => o.setName('motivo').setDescription('Motivo (opcional)'))
    )
    .addSubcommand((s) =>
      s
        .setName('listar')
        .setDescription('Listar todos os cargos do servidor')
    )
    .addSubcommand((s) =>
      s
        .setName('editar')
        .setDescription('Editar um cargo existente')
        .addRoleOption((o) => o.setName('cargo').setDescription('Cargo a editar').setRequired(true))
        .addStringOption((o) => o.setName('novo_nome').setDescription('Novo nome').setMaxLength(100))
        .addStringOption((o) =>
          o.setName('cor').setDescription('Nova cor').addChoices(
            { name: 'Vermelho Neon', value: '#ff0040' },
            { name: 'Vermelho', value: '#e74c3c' },
            { name: 'Amarelo', value: '#f1c40f' },
            { name: 'Verde', value: '#2ecc71' },
            { name: 'Azul', value: '#3498db' },
            { name: 'Roxo', value: '#9b59b6' }
          )
        )
    ),

  async execute(interaction) {
    const grupo = interaction.options.getSubcommandGroup(false);
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const botMember = guild.members.me;

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({ content: '❌ Você precisa da permissão **Gerenciar Cargos**.', ephemeral: true });
    }

    if (sub === 'listar') {
      const cargos = guild.roles.cache
        .filter((r) => r.id !== guild.id)
        .sort((a, b) => b.position - a.position);

      let texto = '';
      for (const r of cargos.values()) {
        texto += `${r} **${r.name}** \`(${r.members.size} membros)\` — ID: \`${r.id}\`\n`;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🏷️ Cargos de "${guild.name}"`)
        .setColor('#e74c3c')
        .setDescription(texto || 'Nenhum cargo encontrado.')
        .setFooter({ text: `${cargos.size} cargos no total` })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (grupo === 'criar' && sub === 'simples') {
      const nome = interaction.options.getString('nome');
      let cor = interaction.options.getString('cor') || '#ff0040';
      const exibir = interaction.options.getBoolean('exibir') !== false;
      const menc = interaction.options.getBoolean('mencionavel') || false;
      if (cor === 'RANDOM') cor = 'Random';
      try {
        const role = await guild.roles.create({
          name: nome,
          color: cor,
          hoist: exibir,
          mentionable: menc,
          reason: `Criado por ${interaction.user.tag} via comando`,
        });
        return interaction.reply({
          content: `🏷️ Cargo ${role} criado com sucesso!\nNome: **${role.name}**\nID: \`${role.id}\``,
          ephemeral: false,
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Erro: ${e.message}`, ephemeral: true });
      }
    }

    if (grupo === 'dar' && sub === 'membro') {
      const usuario = interaction.options.getMember('usuario');
      const cargo = interaction.options.getRole('cargo');
      if (!usuario) return interaction.reply({ content: '❌ Membro não encontrado.', ephemeral: true });
      if (cargo.position >= botMember.roles.highest.position) {
        return interaction.reply({ content: '❌ Não posso conceder um cargo igual ou acima do meu.', ephemeral: true });
      }
      try {
        await usuario.roles.add(cargo, `Dado por ${interaction.user.tag}`);
        return interaction.reply({
          content: `✅ Cargo ${cargo} concedido a ${usuario}!`,
          ephemeral: false,
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Erro: ${e.message}`, ephemeral: true });
      }
    }

    if (grupo === 'dar' && sub === 'todos') {
      const cargo = interaction.options.getRole('cargo');
      if (cargo.position >= botMember.roles.highest.position) {
        return interaction.reply({ content: '❌ Cargo muito alto para eu dar.', ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: false });
      try {
        const membros = await guild.members.fetch();
        let count = 0;
        for (const m of membros.values()) {
          if (!m.roles.cache.has(cargo.id) && !m.user.bot) {
            try {
              await m.roles.add(cargo);
              count++;
            } catch (_) {}
          }
        }
        return interaction.editReply(`✅ Cargo ${cargo} dado a **${count}** membros humanos com sucesso!`);
      } catch (e) {
        return interaction.editReply(`❌ Erro: ${e.message}`);
      }
    }

    if (grupo === 'remover' && sub === 'membro') {
      const usuario = interaction.options.getMember('usuario');
      const cargo = interaction.options.getRole('cargo');
      if (!usuario) return interaction.reply({ content: '❌ Membro não encontrado.', ephemeral: true });
      try {
        await usuario.roles.remove(cargo, `Removido por ${interaction.user.tag}`);
        return interaction.reply({
          content: `✅ Cargo ${cargo} removido de ${usuario}.`,
          ephemeral: false,
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Erro: ${e.message}`, ephemeral: true });
      }
    }

    if (sub === 'deletar') {
      const cargo = interaction.options.getRole('cargo');
      const motivo = interaction.options.getString('motivo') || 'Sem motivo';
      if (cargo.position >= botMember.roles.highest.position || cargo.managed) {
        return interaction.reply({ content: '❌ Não posso deletar este cargo (cargo do bot ou acima, ou gerenciado por integração).', ephemeral: true });
      }
      const nomeCargo = cargo.name;
      try {
        await cargo.delete(`Excluído por ${interaction.user.tag}: ${motivo}`);
        return interaction.reply({
          content: `🗑️ Cargo **@${nomeCargo}** foi excluído.\nMotivo: ${motivo}`,
          ephemeral: false,
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Erro: ${e.message}`, ephemeral: true });
      }
    }

    if (sub === 'editar') {
      const cargo = interaction.options.getRole('cargo');
      const novoNome = interaction.options.getString('novo_nome');
      const novaCor = interaction.options.getString('cor');
      if (cargo.managed) return interaction.reply({ content: '❌ Cargo gerenciado por integração não pode ser editado.', ephemeral: true });
      const edits = {};
      if (novoNome) edits.name = novoNome;
      if (novaCor) edits.color = novaCor;
      if (!Object.keys(edits).length) return interaction.reply({ content: '❌ Nenhuma alteração foi informada.', ephemeral: true });
      try {
        const antigo = cargo.name;
        await cargo.edit(edits, `Editado por ${interaction.user.tag}`);
        return interaction.reply({
          content: `✅ Cargo editado com sucesso!\n${antigo !== cargo.name ? `Nome: \`${antigo}\` → \`${cargo.name}\`\n` : ''}${novaCor ? `Cor atualizada para \`${novaCor}\`` : ''}`,
          ephemeral: false,
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Erro: ${e.message}`, ephemeral: true });
      }
    }
  },
};
