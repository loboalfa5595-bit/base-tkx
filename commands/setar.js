const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ComponentType,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const {
  getGuildConfig,
  getCargos,
  getCargoByTag,
  upsertMembro,
  getMembro,
  criarSetagemPendente,
  getSetagemPendente,
  getSetagensPendentesPorGuild,
  atualizarStatusSetagem,
} = require('../database');
const configCmd = require('./config');

const MODAL_SETAR = 'setar:form';
const SELECT_CARGO = 'setar:selectcargo';
const BTN_APROVAR = 'setar:aprovar';
const BTN_REPROVAR = 'setar:reprovar';
const BTN_SETAR_SELF = 'setar:btnself';
const MODAL_REPROVAR = 'setar:reprovar:modal';
const MODO_SELF = 'self';
const MODO_OUTRO = 'outro';

function corHex(cor) {
  if (!cor) return '#ff0040';
  const m = /^#?([0-9A-Fa-f]{6})$/.exec(cor);
  return m ? `#${m[1]}` : '#ff0040';
}

async function aplicarSetagemReal(client, { guildId, userId, cargoTag, nome, identificador, aprovadorId }) {
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return { ok: false, erro: 'Servidor não encontrado.' };

  const [cfg, cargoDef, member] = await Promise.all([
    getGuildConfig(guildId),
    getCargoByTag(guildId, cargoTag),
    guild.members.fetch(userId).catch(() => null),
  ]);

  if (!member) return { ok: false, erro: 'Membro não está mais no servidor.' };

  const apelido = configCmd.formatarApelido(cfg.nickname_template, cargoTag, nome, identificador);
  const erros = [];

  try {
    await member.setNickname(apelido, `Setagem aprovada por ${aprovadorId}`);
  } catch (e) {
    erros.push(`Não consigo alterar o apelido (cargo acima do meu? / permissão ausente): ${e.message}`);
  }

  if (cfg.set_form_role_assignment && cargoDef?.discord_role_id) {
    try {
      if (!member.roles.cache.has(cargoDef.discord_role_id)) {
        await member.roles.add(cargoDef.discord_role_id, `Setagem aprovada por ${aprovadorId}`);
      }
    } catch (e) {
      erros.push(`Não consigo dar o cargo <@&${cargoDef.discord_role_id}> (acima do meu / falta permissão): ${e.message}`);
    }
  }

  await upsertMembro({
    user_id: userId,
    guild_id: guildId,
    nome,
    identificador,
    cargo_tag: cargoTag,
    approved_by: aprovadorId,
    approved_at: new Date().toISOString(),
  });

  return { ok: true, apelido, erros, member, cargoDef };
}

async function enviarDMStatus(client, { userId, guildId, cfg, vars }) {
  if (!cfg.set_form_dm_enabled) return null;
  try {
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return null;
    const mensagem = configCmd.formatarMensagemDM(cfg.set_form_dm_message, vars);
    const dm = await user.createDM().catch(() => null);
    if (!dm) return null;
    await dm.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(`📬 Resultado da Setagem — ${vars.STATUS}`)
          .setColor(vars.STATUS === 'APROVADA' ? '#2ecc71' : '#e74c3c')
          .setDescription(mensagem || '_Sem mensagem personalizada._')
          .setFooter({ text: guildId ? ((client.guilds.cache.get(guildId)?.name) || '') : '' })
          .setTimestamp(),
      ],
    });
    return true;
  } catch (e) {
    return false;
  }
}

async function enviarLogSetagem(client, { guildId, tipo, embed }) {
  try {
    const cfg = await getGuildConfig(guildId);
    if (!cfg.set_log_channel_id) return null;
    const ch = await client.channels.fetch(cfg.set_log_channel_id).catch(() => null);
    if (!ch || !ch.isTextBased()) return null;
    return ch.send({ embeds: [embed] });
  } catch (e) {
    return null;
  }
}

module.exports = {
  MODAL_SETAR,
  SELECT_CARGO,
  BTN_APROVAR,
  BTN_REPROVAR,
  MODAL_REPROVAR,
  BTN_SETAR_SELF,
  MODO_SELF,
  MODO_OUTRO,

  data: new SlashCommandBuilder()
    .setName('setar')
    .setDescription('Solicitar ou realizar setagem de membro')
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
    .addSubcommand((s) => s.setName('eu').setDescription('Solicitar sua própria setagem (abre formulário)'))
    .addSubcommand((s) =>
      s.setName('membro').setDescription('Setar outro membro (Staff — abre formulário)')
        .addUserOption((o) => o.setName('usuario').setDescription('Usuário a ser setado').setRequired(true))
    )
    .addSubcommand((s) =>
      s.setName('ver').setDescription('Ver sua setagem ou de alguém')
        .addUserOption((o) => o.setName('usuario').setDescription('Usuário (opcional)'))
    )
    .addSubcommand((s) =>
      s.setName('pendentes').setDescription('[Staff] Ver lista de solicitações pendentes')
    )
    .addSubcommand((s) =>
      s.setName('cancelar').setDescription('[Staff] Cancelar uma solicitação pelo ID')
        .addIntegerOption((o) => o.setName('id').setDescription('ID da solicitação pendente').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const gid = interaction.guild.id;
    const [cfg, cargos] = await Promise.all([getGuildConfig(gid), getCargos(gid)]);

    if (cargos.length === 0) {
      return interaction.reply({
        content: '❌ Nenhum cargo cadastrado. Use `/config addcargo` antes.',
        ephemeral: true,
      });
    }

    if (sub === 'eu') return abrirSelectCargo(interaction, interaction.user, MODO_SELF, cargos, cfg);

    if (sub === 'membro') {
      const caller = interaction.member;
      const canManage =
        caller.permissions.has(PermissionFlagsBits.ManageNicknames) ||
        caller.permissions.has(PermissionFlagsBits.Administrator);
      if (!canManage) {
        return interaction.reply({
          content: '❌ Você precisa da permissão **Gerenciar Apelidos** para setar outros membros.',
          ephemeral: true,
        });
      }
      const target = interaction.options.getUser('usuario');
      if (!target) {
        return interaction.reply({ content: '❌ Usuário inválido.', ephemeral: true });
      }
      return abrirSelectCargo(interaction, target, MODO_OUTRO, cargos, cfg);
    }

    if (sub === 'ver') {
      const target = interaction.options.getUser('usuario') || interaction.user;
      const info = await getMembro(target.id);
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      const apelidoAtual = member?.nickname || target.username;

      const embed = new EmbedBuilder()
        .setTitle('📋 Dados da Setagem')
        .setThumbnail(target.displayAvatarURL({ dynamic: true }))
        .setColor('#3498db')
        .addFields(
          { name: 'Usuário', value: `${target}`, inline: true },
          { name: 'Apelido Atual', value: apelidoAtual, inline: true }
        );

      if (info) {
        embed.addFields(
          { name: 'Nome', value: info.nome, inline: true },
          { name: 'ID', value: info.identificador, inline: true },
          { name: 'TAG Cargo', value: `[${info.cargo_tag}]`, inline: true }
        );
        if (info.approved_by) {
          try {
            const st = await interaction.client.users.fetch(info.approved_by).catch(() => null);
            embed.addFields({
              name: 'Aprovado por',
              value: st ? `${st}` : `<@${info.approved_by}>`,
              inline: true,
            });
          } catch (_) {}
        }
      } else {
        embed.addFields({ name: 'Status', value: '⚠️ Usuário não setado.', inline: false });
      }

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'pendentes') {
      const list = await getSetagensPendentesPorGuild(gid);
      const canManage =
        interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames) ||
        interaction.member.permissions.has(PermissionFlagsBits.Administrator);
      if (!canManage) {
        return interaction.reply({
          content: '❌ Você precisa da permissão **Gerenciar Apelidos**.',
          ephemeral: true,
        });
      }
      if (list.length === 0) {
        return interaction.reply({ content: '✅ Nenhuma solicitação pendente.', ephemeral: true });
      }
      const embed = new EmbedBuilder()
        .setTitle(`🗂️ Solicitações Pendentes (${list.length})`)
        .setColor(corHex(cfg.set_form_color));
      for (const r of list.slice(0, 20)) {
        const user = await interaction.client.users.fetch(r.user_id).catch(() => null);
        embed.addFields({
          name: `#${r.id} • ${r.cargo_tag} • ${r.requested_at}`,
          value:
            `Usuário: ${user ? `${user} (\`${user.tag}\`)` : `<@${r.user_id}>`}\n` +
            `Nome: \`${r.nome}\` • ID: \`${r.identificador}\`\n` +
            (cfg.set_approval_channel_id && r.approval_message_id
              ? `[Ir para a mensagem](https://discord.com/channels/${gid}/${cfg.set_approval_channel_id}/${r.approval_message_id})`
              : ''),
          inline: false,
        });
      }
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'cancelar') {
      const canManage =
        interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames) ||
        interaction.member.permissions.has(PermissionFlagsBits.Administrator);
      if (!canManage) {
        return interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });
      }
      const id = interaction.options.getInteger('id');
      const reg = await getSetagemPendente(id);
      if (!reg) return interaction.reply({ content: '❌ Solicitação não encontrada.', ephemeral: true });
      await atualizarStatusSetagem(id, {
        status: 'CANCELADA',
        approver_id: interaction.user.id,
        approved_at: new Date().toISOString(),
        reason: 'Cancelada por staff',
      });
      if (reg.approval_channel_id && reg.approval_message_id) {
        try {
          const ch = await interaction.client.channels.fetch(reg.approval_channel_id).catch(() => null);
          if (ch && ch.isTextBased()) {
            const msg = await ch.messages.fetch(reg.approval_message_id).catch(() => null);
            if (msg) {
              const edit = new EmbedBuilder(msg.embeds[0]?.data || {})
                .setColor('#e67e22')
                .setTitle('❌ Solicitação CANCELADA')
                .setFooter({ text: `Cancelada por ${interaction.user.tag} • ID: ${id}` });
              await msg.edit({ embeds: [edit], components: [] }).catch(() => {});
            }
          }
        } catch (_) {}
      }
      return interaction.reply({ content: `✅ Solicitação #${id} cancelada.`, ephemeral: true });
    }
  },

  async handleAutocomplete(_interaction) {
    return false;
  },

  async handleButton(interaction) {
    if (interaction.customId.startsWith(BTN_SETAR_SELF)) {
      const gid = interaction.guild.id;
      const [cfg, cargos] = await Promise.all([getGuildConfig(gid), getCargos(gid)]);
      if (cargos.length === 0) {
        await interaction.reply({
          content: '❌ Nenhum cargo cadastrado ainda. Contate um administrador.',
          ephemeral: true,
        });
        return true;
      }
      await abrirSelectCargo(interaction, interaction.user, MODO_SELF, cargos, cfg);
      return true;
    }

    if (interaction.customId.startsWith(BTN_APROVAR) || interaction.customId.startsWith(BTN_REPROVAR)) {
      const canManage =
        interaction.member?.permissions?.has(PermissionFlagsBits.ManageNicknames) ||
        interaction.member?.permissions?.has(PermissionFlagsBits.Administrator);
      if (!canManage) {
        await interaction.reply({
          content: '❌ Apenas staff com permissão **Gerenciar Apelidos** pode aprovar/reprovar.',
          ephemeral: true,
        });
        return true;
      }
      const parts = interaction.customId.split(':');
      const setId = Number(parts[2]);
      if (!setId) {
        await interaction.reply({ content: '❌ Solicitação inválida.', ephemeral: true });
        return true;
      }
      const reg = await getSetagemPendente(setId);
      if (!reg) {
        await interaction.reply({ content: '❌ Solicitação não encontrada.', ephemeral: true });
        return true;
      }
      if (reg.status !== 'PENDENTE') {
        await interaction.reply({
          content: `❌ Esta solicitação já foi **${reg.status}**.`,
          ephemeral: true,
        });
        return true;
      }
      if (interaction.customId.startsWith(BTN_APROVAR)) {
        await aprovarSolicitacao(interaction, reg);
        return true;
      }
      if (interaction.customId.startsWith(BTN_REPROVAR)) {
        await abrirModalReprovar(interaction, setId);
        return true;
      }
    }
    return false;
  },

  async handleSelectMenu(interaction) {
    if (!interaction.customId.startsWith(SELECT_CARGO)) return false;
    const parts = interaction.customId.split(':');
    const modo = parts[2];
    const userId = parts[3];
    if (!modo || !userId) {
      await interaction.reply({ content: '❌ Menu inválido, tente novamente.', ephemeral: true });
      return true;
    }
    if (interaction.user.id !== userId && modo === MODO_SELF) {
      await interaction.reply({ content: '❌ Este menu não é para você.', ephemeral: true });
      return true;
    }
    const gid = interaction.guild.id;
    const cfg = await getGuildConfig(gid);
    const cargoTag = interaction.values[0];
    const targetUser =
      modo === MODO_SELF
        ? interaction.user
        : await interaction.client.users.fetch(userId).catch(() => null);
    if (!targetUser) {
      await interaction.reply({ content: '❌ Usuário inválido.', ephemeral: true });
      return true;
    }
    await abrirFormSetar(interaction, targetUser, modo, cargoTag, cfg);
    return true;
  },

  async handleModal(interaction) {
    if (interaction.customId.startsWith(MODAL_REPROVAR)) {
      const parts = interaction.customId.split(':');
      const setId = Number(parts[3]);
      if (!setId) {
        await interaction.reply({ content: '❌ Modal inválido.', ephemeral: true });
        return true;
      }
      const motivo = interaction.fields.getTextInputValue('reprovar_motivo').trim() || 'Sem motivo informado.';
      await reprovarSolicitacao(interaction, setId, motivo);
      return true;
    }

    if (!interaction.customId.startsWith(MODAL_SETAR)) return false;
    const gid = interaction.guild.id;
    const cfg = await getGuildConfig(gid);
    const parts = interaction.customId.split(':');
    const modo = parts[2];
    const userId = parts[3];
    const cargoTag = parts[4];
    if (!modo || !userId || !cargoTag) {
      await interaction.reply({ content: '❌ Formulário inválido, tente novamente.', ephemeral: true });
      return true;
    }

    const nome = interaction.fields.getTextInputValue('setar_nome').trim();
    const identificador = interaction.fields.getTextInputValue('setar_id').trim();

    const targetUser =
      modo === MODO_SELF
        ? interaction.user
        : await interaction.client.users.fetch(userId).catch(() => null);
    if (!targetUser) {
      await interaction.reply({ content: '❌ Usuário inválido.', ephemeral: true });
      return true;
    }

    const needApproval = Boolean(cfg.set_form_require_approval) && modo === MODO_SELF;

    if (needApproval) {
      if (!cfg.set_approval_channel_id) {
        await interaction.reply({
          content:
            '⚠️ **Canal de aprovação não está configurado.**\n' +
            'Um administrador deve usar `/config formulario canal-aprovacao` primeiro.\n' +
            'Ou desligue a aprovação obrigatória com `/config formulario opcoes opcao:"Aprovação obrigatória" valor:falso`.',
          ephemeral: true,
        });
        return true;
      }
      const ch = await interaction.client.channels.fetch(cfg.set_approval_channel_id).catch(() => null);
      if (!ch || !ch.isTextBased()) {
        await interaction.reply({
          content: '❌ O canal de aprovação configurado não existe ou não é de texto. Refaça a configuração.',
          ephemeral: true,
        });
        return true;
      }
      const cargoDef = await getCargoByTag(gid, cargoTag);
      const embed = new EmbedBuilder()
        .setTitle(cfg.set_form_title || 'Nova solicitação de Setagem')
        .setDescription(cfg.set_form_description || null)
        .setColor(corHex(cfg.set_form_color))
        .setAuthor({ name: targetUser.tag, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
        .addFields(
          { name: '👤 Usuário', value: `${targetUser}\n\`${targetUser.tag}\``, inline: true },
          { name: '🏷️ Cargo solicitado', value: cargoDef ? `${cargoDef.nome} [${cargoDef.tag}]` : `[${cargoTag}]`, inline: true },
          { name: '📝 Nome', value: nome.slice(0, 1020), inline: true },
          { name: '🆔 Identificador', value: identificador.slice(0, 1020), inline: true }
        )
        .setFooter({ text: `ID da solicitação: {ID} • ${cfg.set_form_footer || ''}`.replace('{ID}', '') })
        .setTimestamp();

      if (cfg.set_form_image) embed.setImage(cfg.set_form_image);

      const botoes = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`${BTN_APROVAR}:PLACEHOLDER`)
          .setLabel('✅ Aprovar')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`${BTN_REPROVAR}:PLACEHOLDER`)
          .setLabel('❌ Reprovar')
          .setStyle(ButtonStyle.Danger)
      );
      const sent = await ch.send({ embeds: [embed], components: [botoes] });
      const { id: regId } = await criarSetagemPendente({
        guild_id: gid,
        user_id: targetUser.id,
        nome,
        identificador,
        cargo_tag: cargoTag,
        approval_channel_id: ch.id,
        approval_message_id: sent.id,
      });
      embed.setFooter({ text: `Solicitação #${regId} • ${cfg.set_form_footer || 'Sistema de Setagem'}` });
      botoes.components[0].setCustomId(`${BTN_APROVAR}:${regId}`);
      botoes.components[1].setCustomId(`${BTN_REPROVAR}:${regId}`);
      await sent.edit({ embeds: [embed], components: [botoes] });

      const respostaStaff =
        modo === MODO_OUTRO
          ? `✅ Solicitação enviada para o canal <#${ch.id}>. ID: \`#${regId}\`.`
          : `✅ Solicitação enviada! Aguarde a aprovação de um staff no canal <#${ch.id}>. ID: \`#${regId}\`.`;
      await interaction.reply({ content: respostaStaff, ephemeral: true });

      await enviarLogSetagem(interaction.client, {
        guildId: gid,
        embed: new EmbedBuilder()
          .setTitle('📤 Solicitação Criada')
          .setColor(corHex(cfg.set_form_color))
          .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
          .addFields(
            { name: 'ID', value: `#${regId}`, inline: true },
            { name: 'Usuário', value: `${targetUser}`, inline: true },
            { name: 'Cargo', value: `[${cargoTag}]`, inline: true },
            { name: 'Nome', value: nome, inline: true },
            { name: 'Identificador', value: identificador, inline: true }
          )
          .setTimestamp(),
      });

      return true;
    }

    const callerIsStaff =
      interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames) ||
      interaction.member.permissions.has(PermissionFlagsBits.Administrator);

    if (modo === MODO_OUTRO && !callerIsStaff) {
      await interaction.reply({ content: '❌ Sem permissão.', ephemeral: true });
      return true;
    }

    await interaction.deferReply({ ephemeral: true });

    const res = await aplicarSetagemReal(interaction.client, {
      guildId: gid,
      userId: targetUser.id,
      cargoTag,
      nome,
      identificador,
      aprovadorId: interaction.user.id,
    });

    if (!res.ok) {
      await interaction.editReply({ content: `❌ ${res.erro}` });
      return true;
    }

    const embedFinal = new EmbedBuilder()
      .setTitle('✅ Setagem Aplicada')
      .setColor('#2ecc71')
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Usuário', value: `${targetUser}`, inline: true },
        { name: 'Novo apelido', value: `\`${res.apelido}\``, inline: true },
        { name: 'Nome', value: nome, inline: true },
        { name: 'ID', value: identificador, inline: true },
        { name: 'TAG', value: `[${cargoTag}]`, inline: true },
        { name: 'Aprovado por', value: `${interaction.user}`, inline: true }
      )
      .setTimestamp();
    if (res.erros && res.erros.length) {
      embedFinal.addFields({ name: '⚠️ Observações', value: res.erros.map((e) => '• ' + e).join('\n').slice(0, 1020) });
    }
    await interaction.editReply({ embeds: [embedFinal] });

    await enviarDMStatus(interaction.client, {
      userId: targetUser.id,
      guildId: gid,
      cfg,
      vars: {
        USER: `${targetUser}`,
        STATUS: 'APROVADA',
        TAG: cargoTag,
        NOME: nome,
        ID: identificador,
        STAFF: `${interaction.user}`,
        OBS: res.erros?.length ? `Observações: ${res.erros.join(' | ')}` : '',
      },
    });

    await enviarLogSetagem(interaction.client, {
      guildId: gid,
      embed: new EmbedBuilder()
        .setTitle('✅ Setagem Aplicada (direta)')
        .setColor('#2ecc71')
        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
        .addFields(
          { name: 'Usuário', value: `${targetUser}`, inline: true },
          { name: 'Apelido', value: `\`${res.apelido}\``, inline: true },
          { name: 'TAG', value: `[${cargoTag}]`, inline: true }
        )
        .setTimestamp(),
    });
    return true;
  },
};

async function abrirSelectCargo(interaction, targetUser, modo, cargos, cfg) {
  const options = cargos.map((c) => ({
    label: c.nome,
    description: `TAG: [${c.tag}]${c.discord_role_id ? ' • Cargo Discord vinculado' : ''}`,
    value: c.tag,
  }));
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${SELECT_CARGO}:${modo}:${targetUser.id}`)
      .setPlaceholder('Selecione o cargo...')
      .addOptions(options)
  );
  const embed = new EmbedBuilder()
    .setTitle(cfg.set_form_title || '🏷️ Escolha o Cargo')
    .setDescription(
      (cfg.set_form_description || `Setando: ${targetUser}\nModelo de apelido: \`${cfg.nickname_template}\``) +
        `\n\nCaso precise de aprovação, será enviado ao canal de staff.`
    )
    .setColor(corHex(cfg.set_form_color));
  if (cfg.set_form_image) embed.setImage(cfg.set_form_image);
  if (cfg.set_form_footer) embed.setFooter({ text: cfg.set_form_footer });

  const send = interaction.replied || interaction.deferred ? 'followUp' : 'reply';
  const reply = await interaction[send]({
    embeds: [embed],
    components: [row],
    ephemeral: true,
    fetchReply: true,
  });

  const filter = (i) => i.customId.startsWith(SELECT_CARGO) && i.user.id === interaction.user.id;
  try {
    const sel = await reply.awaitMessageComponent({
      filter,
      componentType: ComponentType.StringSelect,
      time: 120_000,
    });
    const cargoTag = sel.values[0];
    return abrirFormSetar(sel, targetUser, modo, cargoTag, cfg);
  } catch {
    return interaction.editReply({
      content: '⏱️ Tempo expirado. Tente novamente.',
      components: [],
      embeds: [],
    });
  }
}

async function abrirFormSetar(interaction, targetUser, modo, cargoTag, cfg) {
  const modal = new ModalBuilder()
    .setCustomId(`${MODAL_SETAR}:${modo}:${targetUser.id}:${cargoTag}`)
    .setTitle(`Setar - [${cargoTag}]`);
  const row1 = new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('setar_nome')
      .setLabel('Nome')
      .setPlaceholder('Ex: João Silva')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(30)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('setar_id')
      .setLabel('ID / Identificador')
      .setPlaceholder('Ex: 001')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(20)
  );
  modal.addComponents(row1, row2);
  return interaction.showModal(modal);
}

async function abrirModalReprovar(interaction, setId) {
  const modal = new ModalBuilder()
    .setCustomId(`${MODAL_REPROVAR}:${setId}`)
    .setTitle('Reprovar Solicitação');
  const r1 = new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('reprovar_motivo')
      .setLabel('Motivo da reprovação')
      .setPlaceholder('Será enviado para o usuário via DM')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(800)
  );
  modal.addComponents(r1);
  return interaction.showModal(modal);
}

async function aprovarSolicitacao(interaction, reg) {
  await interaction.deferReply({ ephemeral: true });
  const cfg = await getGuildConfig(reg.guild_id);
  const res = await aplicarSetagemReal(interaction.client, {
    guildId: reg.guild_id,
    userId: reg.user_id,
    cargoTag: reg.cargo_tag,
    nome: reg.nome,
    identificador: reg.identificador,
    aprovadorId: interaction.user.id,
  });

  if (!res.ok) {
    await interaction.editReply({ content: `❌ ${res.erro}` });
    return;
  }

  await atualizarStatusSetagem(reg.id, {
    status: 'APROVADA',
    approver_id: interaction.user.id,
    approved_at: new Date().toISOString(),
  });

  const user = await interaction.client.users.fetch(reg.user_id).catch(() => null);
  const embedAjustado = new EmbedBuilder()
    .setTitle('✅ Solicitação APROVADA')
    .setColor('#2ecc71')
    .setThumbnail(user?.displayAvatarURL({ dynamic: true }) || null)
    .addFields(
      { name: 'Usuário', value: user ? `${user}` : `<@${reg.user_id}>`, inline: true },
      { name: 'Apelido aplicado', value: `\`${res.apelido}\``, inline: true },
      { name: 'TAG', value: `[${reg.cargo_tag}]`, inline: true },
      { name: 'Nome', value: reg.nome, inline: true },
      { name: 'ID', value: reg.identificador, inline: true },
      { name: 'Aprovado por', value: `${interaction.user}`, inline: true }
    )
    .setFooter({ text: `Solicitação #${reg.id} aprovada por ${interaction.user.tag}` })
    .setTimestamp();
  if (res.erros && res.erros.length) {
    embedAjustado.addFields({ name: '⚠️ Observações', value: res.erros.map((e) => '• ' + e).join('\n').slice(0, 1020) });
  }

  try {
    const ch = await interaction.client.channels.fetch(reg.approval_channel_id).catch(() => null);
    if (ch && ch.isTextBased() && reg.approval_message_id) {
      const msg = await ch.messages.fetch(reg.approval_message_id).catch(() => null);
      if (msg) await msg.edit({ embeds: [embedAjustado], components: [] });
    }
  } catch (_) {}

  await interaction.editReply({ embeds: [embedAjustado] });

  await enviarDMStatus(interaction.client, {
    userId: reg.user_id,
    guildId: reg.guild_id,
    cfg,
    vars: {
      USER: user ? `${user}` : `<@${reg.user_id}>`,
      STATUS: 'APROVADA',
      TAG: reg.cargo_tag,
      NOME: reg.nome,
      ID: reg.identificador,
      STAFF: `${interaction.user}`,
      OBS: res.erros?.length ? `Observações: ${res.erros.join(' | ')}` : '',
    },
  });

  await enviarLogSetagem(interaction.client, {
    guildId: reg.guild_id,
    embed: new EmbedBuilder()
      .setTitle('✅ Solicitação Aprovada')
      .setColor('#2ecc71')
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
      .addFields(
        { name: 'ID', value: `#${reg.id}`, inline: true },
        { name: 'Usuário', value: user ? `${user}` : `<@${reg.user_id}>`, inline: true },
        { name: 'Apelido', value: `\`${res.apelido}\``, inline: true }
      )
      .setTimestamp(),
  });
}

async function reprovarSolicitacao(interaction, setId, motivo) {
  const reg = await getSetagemPendente(setId);
  if (!reg) {
    await interaction.reply({ content: '❌ Solicitação não encontrada.', ephemeral: true });
    return;
  }
  await atualizarStatusSetagem(setId, {
    status: 'REPROVADA',
    approver_id: interaction.user.id,
    approved_at: new Date().toISOString(),
    reason: motivo,
  });
  const cfg = await getGuildConfig(reg.guild_id);
  const user = await interaction.client.users.fetch(reg.user_id).catch(() => null);

  const embed = new EmbedBuilder()
    .setTitle('❌ Solicitação REPROVADA')
    .setColor('#e74c3c')
    .setThumbnail(user?.displayAvatarURL({ dynamic: true }) || null)
    .addFields(
      { name: 'Usuário', value: user ? `${user}` : `<@${reg.user_id}>`, inline: true },
      { name: 'TAG solicitada', value: `[${reg.cargo_tag}]`, inline: true },
      { name: 'Reprovado por', value: `${interaction.user}`, inline: true },
      { name: 'Motivo', value: motivo.slice(0, 1020), inline: false }
    )
    .setFooter({ text: `Solicitação #${setId} • ${cfg.set_form_footer || ''}` })
    .setTimestamp();

  try {
    const ch = await interaction.client.channels.fetch(reg.approval_channel_id).catch(() => null);
    if (ch && ch.isTextBased() && reg.approval_message_id) {
      const msg = await ch.messages.fetch(reg.approval_message_id).catch(() => null);
      if (msg) await msg.edit({ embeds: [embed], components: [] });
    }
  } catch (_) {}

  await interaction.reply({
    content: `✅ Solicitação #${setId} reprovada. O usuário já foi avisado na DM (se possível).`,
    ephemeral: true,
  });

  await enviarDMStatus(interaction.client, {
    userId: reg.user_id,
    guildId: reg.guild_id,
    cfg,
    vars: {
      USER: user ? `${user}` : `<@${reg.user_id}>`,
      STATUS: 'REPROVADA',
      TAG: reg.cargo_tag,
      NOME: reg.nome,
      ID: reg.identificador,
      STAFF: `${interaction.user}`,
      OBS: `Motivo: ${motivo}`,
    },
  });

  await enviarLogSetagem(interaction.client, {
    guildId: reg.guild_id,
    embed: new EmbedBuilder()
      .setTitle('❌ Solicitação Reprovada')
      .setColor('#e74c3c')
      .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
      .addFields(
        { name: 'ID', value: `#${setId}`, inline: true },
        { name: 'Usuário', value: user ? `${user}` : `<@${reg.user_id}>`, inline: true },
        { name: 'Motivo', value: motivo.slice(0, 1020), inline: false }
      )
      .setTimestamp(),
  });
}
