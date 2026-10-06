const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Comandos de moderação (ADM/STAFF)')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers | PermissionFlagsBits.BanMembers)
    .addSubcommand((s) =>
      s
        .setName('expulsar')
        .setDescription('Expulsar um membro do servidor')
        .addUserOption((o) => o.setName('usuario').setDescription('Membro a expulsar').setRequired(true))
        .addStringOption((o) => o.setName('motivo').setDescription('Motivo da expulsão'))
    )
    .addSubcommand((s) =>
      s
        .setName('banir')
        .setDescription('Banir permanentemente um usuário')
        .addUserOption((o) => o.setName('usuario').setDescription('Usuário a banir').setRequired(true))
        .addStringOption((o) => o.setName('motivo').setDescription('Motivo do banimento'))
        .addIntegerOption((o) => o.setName('apagar_msgs').setDescription('Apagar mensagens recentes (0-7 dias)').setMinValue(0).setMaxValue(7))
    )
    .addSubcommand((s) =>
      s
        .setName('desbanir')
        .setDescription('Remover banimento de um usuário (por ID ou @menção)')
        .addStringOption((o) => o.setName('usuario_id').setDescription('ID do usuário banido').setRequired(true))
        .addStringOption((o) => o.setName('motivo').setDescription('Motivo do desbanimento'))
    )
    .addSubcommand((s) =>
      s
        .setName('castigar')
        .setDescription('Colocar membro de castigo (timeout)')
        .addUserOption((o) => o.setName('usuario').setDescription('Membro').setRequired(true))
        .addIntegerOption((o) => o.setName('minutos').setDescription('Duração em minutos (max 40320)').setRequired(true).setMinValue(1).setMaxValue(40320))
        .addStringOption((o) => o.setName('motivo').setDescription('Motivo do castigo'))
    )
    .addSubcommand((s) =>
      s
        .setName('liberar')
        .setDescription('Remover castigo (timeout) de um membro')
        .addUserOption((o) => o.setName('usuario').setDescription('Membro a liberar').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('avisar')
        .setDescription('Enviar um aviso/warn privado para um membro')
        .addUserOption((o) => o.setName('usuario').setDescription('Membro a avisar').setRequired(true))
        .addStringOption((o) => o.setName('motivo').setDescription('Conteúdo do aviso').setRequired(true).setMaxLength(1500))
    )
    .addSubcommand((s) =>
      s
        .setName('registros')
        .setDescription('Mostrar infrações de um membro (avisos/banimentos)')
        .addUserOption((o) => o.setName('usuario').setDescription('Membro').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guild = interaction.guild;
    const botMember = guild.members.me;
    const executor = interaction.member;

    const podeKick = executor.permissions.has(PermissionFlagsBits.KickMembers);
    const podeBan = executor.permissions.has(PermissionFlagsBits.BanMembers);
    const podeTimeout = executor.permissions.has(PermissionFlagsBits.ModerateMembers);

    async function logarModeracao(acao, usuario, motivo, extra) {
      const cfg = require('../database').getGuildConfig(guild.id);
      if (!cfg) return;
    }

    if (sub === 'expulsar') {
      if (!podeKick) return interaction.reply({ content: '❌ Você precisa de **Expulsar Membros**.', ephemeral: true });
      const alvo = interaction.options.getMember('usuario');
      const motivo = interaction.options.getString('motivo') || 'Sem motivo informado';
      if (!alvo) return interaction.reply({ content: '❌ Membro não encontrado no servidor.', ephemeral: true });
      if (alvo.user.id === executor.id) return interaction.reply({ content: '❌ Você não pode se expulsar.', ephemeral: true });
      if (alvo.roles.highest.position >= executor.roles.highest.position && !executor.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Hierarquia: você não pode expulsar alguém com cargo igual ou superior.', ephemeral: true });
      }
      if (alvo.roles.highest.position >= botMember.roles.highest.position || alvo.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Não consigo expulsar este membro (cargo acima do meu ou administrador).', ephemeral: true });
      }
      try {
        const tag = alvo.user.tag;
        try { await alvo.send(`⚠️ Você foi **expulso** do servidor **${guild.name}**\n**Motivo:** ${motivo}\n**Por:** ${executor.user.tag}`).catch(() => {}); } catch (_) {}
        await alvo.kick(`${motivo} — por ${executor.user.tag}`);
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#f39c12')
              .setTitle('👢 Membro Expulso')
              .setThumbnail(alvo.user.displayAvatarURL({ dynamic: true }))
              .addFields(
                { name: 'Membro', value: `${alvo.user}`, inline: true },
                { name: 'ID', value: `\`${alvo.user.id}\``, inline: true },
                { name: 'Motivo', value: motivo, inline: false },
                { name: 'Por', value: `${executor.user}`, inline: true }
              )
              .setTimestamp(),
          ],
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Erro: ${e.message}`, ephemeral: true });
      }
    }

    if (sub === 'banir') {
      if (!podeBan) return interaction.reply({ content: '❌ Você precisa de **Banir Membros**.', ephemeral: true });
      const alvoUser = interaction.options.getUser('usuario');
      const motivo = interaction.options.getString('motivo') || 'Sem motivo informado';
      const dias = interaction.options.getInteger('apagar_msgs') ?? 0;
      if (alvoUser.id === executor.id) return interaction.reply({ content: '❌ Você não pode se banir.', ephemeral: true });
      const alvoMember = interaction.options.getMember('usuario');
      if (alvoMember) {
        if (alvoMember.roles.highest.position >= executor.roles.highest.position && !executor.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: '❌ Hierarquia: cargo igual ou superior.', ephemeral: true });
        }
        if (alvoMember.roles.highest.position >= botMember.roles.highest.position || alvoMember.permissions.has(PermissionFlagsBits.Administrator)) {
          return interaction.reply({ content: '❌ Não consigo banir este membro.', ephemeral: true });
        }
      }
      try {
        try {
          const dmCh = await alvoUser.createDM().catch(() => null);
          if (dmCh) await dmCh.send(`🔨 Você foi **banido** de **${guild.name}**\n**Motivo:** ${motivo}\n**Por:** ${executor.user.tag}`).catch(() => {});
        } catch (_) {}
        await guild.members.ban(alvoUser.id, { deleteMessageSeconds: dias * 24 * 60 * 60, reason: `${motivo} — por ${executor.user.tag}` });
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#e74c3c')
              .setTitle('🔨 Usuário Banido')
              .setThumbnail(alvoUser.displayAvatarURL({ dynamic: true }))
              .addFields(
                { name: 'Usuário', value: `${alvoUser}`, inline: true },
                { name: 'ID', value: `\`${alvoUser.id}\``, inline: true },
                { name: 'Motivo', value: motivo, inline: false },
                { name: 'Mensagens apagadas', value: dias ? `Últimos ${dias} dia(s)` : 'Nenhuma', inline: true },
                { name: 'Por', value: `${executor.user}`, inline: true }
              )
              .setTimestamp(),
          ],
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Erro: ${e.message}`, ephemeral: true });
      }
    }

    if (sub === 'desbanir') {
      if (!podeBan) return interaction.reply({ content: '❌ Você precisa de **Banir Membros**.', ephemeral: true });
      const uid = interaction.options.getString('usuario_id').replace(/\D/g, '');
      const motivo = interaction.options.getString('motivo') || 'Sem motivo';
      try {
        const bans = await guild.bans.fetch();
        const banInfo = bans.get(uid);
        if (!banInfo) return interaction.reply({ content: '❌ Este ID não está na lista de banidos.', ephemeral: true });
        await guild.members.unban(uid, `${motivo} — por ${executor.user.tag}`);
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#2ecc71')
              .setTitle('🔓 Usuário Desbanido')
              .setThumbnail(banInfo.user.displayAvatarURL({ dynamic: true }))
              .addFields(
                { name: 'Usuário', value: `${banInfo.user}`, inline: true },
                { name: 'ID', value: `\`${uid}\``, inline: true },
                { name: 'Motivo', value: motivo, inline: false },
                { name: 'Por', value: `${executor.user}`, inline: true }
              )
              .setTimestamp(),
          ],
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Erro: ${e.message}`, ephemeral: true });
      }
    }

    if (sub === 'castigar') {
      if (!podeTimeout) return interaction.reply({ content: '❌ Você precisa de **Moderar Membros**.', ephemeral: true });
      const alvo = interaction.options.getMember('usuario');
      const minutos = interaction.options.getInteger('minutos');
      const motivo = interaction.options.getString('motivo') || 'Sem motivo';
      if (!alvo) return interaction.reply({ content: '❌ Membro não encontrado.', ephemeral: true });
      if (alvo.roles.highest.position >= botMember.roles.highest.position || alvo.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Não consigo castigar este membro.', ephemeral: true });
      }
      try {
        const ms = minutos * 60 * 1000;
        await alvo.timeout(ms, `${motivo} — por ${executor.user.tag}`);
        try { await alvo.send(`⏳ Você recebeu um **castigo** de **${minutos} minuto(s)** em **${guild.name}**\n**Motivo:** ${motivo}`).catch(() => {}); } catch (_) {}
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#9b59b6')
              .setTitle('⏳ Castigo Aplicado')
              .setThumbnail(alvo.user.displayAvatarURL({ dynamic: true }))
              .addFields(
                { name: 'Membro', value: `${alvo.user}`, inline: true },
                { name: 'Duração', value: `${minutos} min`, inline: true },
                { name: 'Motivo', value: motivo, inline: false },
                { name: 'Por', value: `${executor.user}`, inline: true }
              )
              .setTimestamp(),
          ],
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Erro: ${e.message}`, ephemeral: true });
      }
    }

    if (sub === 'liberar') {
      if (!podeTimeout) return interaction.reply({ content: '❌ Você precisa de **Moderar Membros**.', ephemeral: true });
      const alvo = interaction.options.getMember('usuario');
      if (!alvo) return interaction.reply({ content: '❌ Membro não encontrado.', ephemeral: true });
      if (!alvo.isCommunicationDisabled()) {
        return interaction.reply({ content: 'ℹ️ Este membro não está de castigo.', ephemeral: true });
      }
      try {
        await alvo.timeout(null, `Liberado por ${executor.user.tag}`);
        return interaction.reply({ content: `✅ ${alvo.user} foi **liberado** do castigo por ${executor.user}.` });
      } catch (e) {
        return interaction.reply({ content: `❌ Erro: ${e.message}`, ephemeral: true });
      }
    }

    if (sub === 'avisar') {
      if (!podeTimeout && !podeKick) return interaction.reply({ content: '❌ Sem permissão para avisar.', ephemeral: true });
      const alvoUser = interaction.options.getUser('usuario');
      const alvo = interaction.options.getMember('usuario');
      const motivo = interaction.options.getString('motivo');
      try {
        const msg = `📢 **Aviso do Servidor "${guild.name}"**\n\n${motivo}\n\n*— Aviso enviado por ${executor.user.tag}. Repetições podem resultar em punições.*`;
        try { await alvoUser.send(msg).catch(() => {}); } catch (_) {}
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#f1c40f')
              .setTitle('📢 Aviso Enviado')
              .setThumbnail(alvoUser.displayAvatarURL({ dynamic: true }))
              .addFields(
                { name: 'Para', value: `${alvoUser}`, inline: true },
                { name: 'Por', value: `${executor.user}`, inline: true },
                { name: 'Conteúdo', value: motivo.slice(0, 1020), inline: false }
              )
              .setTimestamp(),
          ],
        });
      } catch (e) {
        return interaction.reply({ content: `❌ Erro: ${e.message}`, ephemeral: true });
      }
    }

    if (sub === 'registros') {
      const alvoUser = interaction.options.getUser('usuario');
      const bans = await guild.bans.fetch().catch(() => null);
      const banido = bans?.has(alvoUser.id);
      const alvo = interaction.options.getMember('usuario');
      const embed = new EmbedBuilder()
        .setTitle(`📋 Registros de ${alvoUser.tag}`)
        .setThumbnail(alvoUser.displayAvatarURL({ dynamic: true }))
        .setColor(banido ? '#e74c3c' : '#3498db')
        .addFields(
          { name: 'Status', value: banido ? '🔴 BANIDO' : alvo ? '🟢 No servidor' : '⚪ Não está no servidor', inline: true },
          { name: 'ID', value: `\`${alvoUser.id}\``, inline: true },
          { name: 'Conta criada', value: `<t:${Math.floor(alvoUser.createdTimestamp / 1000)}:D>`, inline: true }
        );
      if (banido) embed.addFields({ name: 'Motivo do banimento', value: bans.get(alvoUser.id).reason || 'Não informado', inline: false });
      if (alvo && alvo.isCommunicationDisabled()) {
        embed.addFields({ name: '⏳ Em castigo até', value: `<t:${Math.floor(alvo.communicationDisabledUntilTimestamp / 1000)}:F>`, inline: false });
      }
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
