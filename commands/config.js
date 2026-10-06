const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ChannelType,
} = require('discord.js');
const {
  getGuildConfig,
  updateGuildConfig,
  getCargos,
  addCargo,
  removeCargo,
  getCargoByTag,
  updateCargoDiscordRole,
} = require('../database');

const MODAL_BOT = 'config:bot';
const MODAL_NICK = 'config:nick';
const MODAL_ADD_CARGO = 'config:addcargo';
const MODAL_FORM_TEXTO = 'config:form:texto';
const MODAL_FORM_DM = 'config:form:dm';
const MODAL_FORM_IMAGEM = 'config:form:image';
const MODAL_REPROVAR = 'config:reprovar';

function criarEmbedConfig(cfg, cargos, canais) {
  const embed = new EmbedBuilder()
    .setTitle(`${cfg.bot_name} - Painel de Configuração`)
    .setColor('#2ecc71')
    .setFooter({ text: `Versão ${cfg.bot_model}` })
    .setTimestamp();

  embed.addFields(
    { name: '🤖 Nome do Bot', value: `\`${cfg.bot_name}\``, inline: true },
    { name: '🔧 Versão/Modelo', value: `\`${cfg.bot_model}\``, inline: true },
    { name: '\n', value: '\n' },
    {
      name: '📝 Modelo de Apelido',
      value: `\`\`\`${cfg.nickname_template}\`\`\`\n**Variáveis:** \`{TAG}\` \`{NOME}\` \`{ID}\``,
      inline: false,
    },
    { name: 'Exemplo', value: formatarApelido(cfg.nickname_template, 'MBR', 'João', '123'), inline: false },
    { name: '\n', value: '\n' },
    {
      name: '🏷️ Cargos Cadastrados',
      value: cargos.length
        ? cargos.map((c) => `• **${c.nome}** → [${c.tag}]${c.discord_role_id ? ` • Cargo Discord: <@&${c.discord_role_id}>` : ''}`).join('\n')
        : 'Nenhum cargo cadastrado.',
      inline: false,
    },
    { name: '\n', value: '\n' },
    {
      name: '📋 Formulário de Setagem',
      value:
        `• **Título:** \`${cfg.set_form_title || '—'}\`\n` +
        `• **Descrição:** ${cfg.set_form_description ? (cfg.set_form_description.length > 80 ? cfg.set_form_description.slice(0, 77) + '…' : cfg.set_form_description) : '—'}\n` +
        `• **Cor:** \`${cfg.set_form_color || '#ff0040'}\`\n` +
        `• **Imagem:** ${cfg.set_form_image ? '[Link](' + cfg.set_form_image + ')' : 'Não configurada'}\n` +
        `• **Rodapé:** \`${cfg.set_form_footer || '—'}\``,
      inline: true,
    },
    {
      name: '📡 Canais Configurados',
      value:
        `• **Canal Aprovação:** ${cfg.set_approval_channel_id && canais?.approval ? canais.approval : '❌ Não definido'}\n` +
        `• **Canal Log:** ${cfg.set_log_channel_id && canais?.log ? canais.log : '❌ Não definido'}\n` +
        `• **Canal Formulário:** ${cfg.set_form_channel_id && canais?.form ? canais.form : '—'}\n` +
        `• **Aprovação obrigatória:** ${cfg.set_form_require_approval ? '✅ Sim (recomendado)' : '⚡ Não (seta direto)'}\n` +
        `• **Dar cargo Discord:** ${cfg.set_form_role_assignment ? '✅ Sim' : '❌ Não'}\n` +
        `• **DM de confirmação:** ${cfg.set_form_dm_enabled ? '✅ Sim' : '❌ Não'}`,
      inline: true,
    }
  );

  if (cfg.set_form_dm_enabled) {
    embed.addFields({
      name: '💬 Mensagem da DM',
      value: `\`\`\`${cfg.set_form_dm_message || ''}\`\`\`\nVariáveis: \`{USER}\` \`{STATUS}\` \`{TAG}\` \`{NOME}\` \`{ID}\` \`{STAFF}\` \`{OBS}\``, inline: false,
    });
  }

  return embed;
}

function formatarApelido(template, tag, nome, id) {
  return template
    .replace(/\{TAG\}/g, tag)
    .replace(/\{NOME\}/g, nome)
    .replace(/\{ID\}/g, id)
    .slice(0, 32);
}

function formatarMensagemDM(template, vars) {
  if (!template) return '';
  return template
    .replace(/\{USER\}/g, String(vars.USER || ''))
    .replace(/\{STATUS\}/g, String(vars.STATUS || ''))
    .replace(/\{TAG\}/g, String(vars.TAG || ''))
    .replace(/\{NOME\}/g, String(vars.NOME || ''))
    .replace(/\{ID\}/g, String(vars.ID || ''))
    .replace(/\{STAFF\}/g, String(vars.STAFF || ''))
    .replace(/\{OBS\}/g, String(vars.OBS || ''));
}

module.exports = {
  MODAL_BOT,
  MODAL_NICK,
  MODAL_ADD_CARGO,
  MODAL_FORM_TEXTO,
  MODAL_FORM_DM,
  MODAL_FORM_IMAGEM,
  MODAL_REPROVAR,
  formatarApelido,
  formatarMensagemDM,

  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Configurações do bot de setagem')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) => s.setName('bot').setDescription('Editar nome e modelo do bot'))
    .addSubcommand((s) => s.setName('apelido').setDescription('Editar modelo de apelido'))
    .addSubcommand((s) => s.setName('addcargo').setDescription('Adicionar novo cargo e tag'))
    .addSubcommand((s) =>
      s
        .setName('vincularcargo')
        .setDescription('Vincular uma TAG a um cargo real do Discord (para ser dado ao aprovar)')
        .addStringOption((o) =>
          o.setName('tag').setDescription('TAG do cargo (ex: MBR)').setRequired(true)
            .setAutocomplete(true)
        )
        .addRoleOption((o) =>
          o.setName('cargo').setDescription('Cargo do Discord a ser atribuído ao aprovar').setRequired(true)
        )
    )
    .addSubcommand((s) =>
      s
        .setName('removercargo')
        .setDescription('Remover cargo por nome ou tag')
        .addStringOption((o) =>
          o.setName('valor').setDescription('Nome ou TAG do cargo').setRequired(true)
        )
    )
    .addSubcommandGroup((g) =>
      g.setName('formulario').setDescription('Personalizar o formulário de setagem')
        .addSubcommand((s) =>
          s.setName('texto').setDescription('Editar título, descrição, cor e rodapé do formulário')
        )
        .addSubcommand((s) =>
          s.setName('mensagempv').setDescription('Editar mensagem que chegará no PV ao aprovar/reprovar')
        )
        .addSubcommand((s) =>
          s.setName('imagem').setDescription('Adicionar ou alterar imagem (banner) do formulário')
        )
        .addSubcommand((s) =>
          s.setName('canal-aprovacao').setDescription('Definir o canal onde os admins aprovam/reprovam')
            .addChannelOption((o) =>
              o.setName('canal').setDescription('Canal de texto para as solicitações').setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
            )
        )
        .addSubcommand((s) =>
          s.setName('canal-log').setDescription('Definir o canal de logs de setagem (opcional)')
            .addChannelOption((o) =>
              o.setName('canal').setDescription('Canal de texto para logs').setRequired(true)
                .addChannelTypes(ChannelType.GuildText)
            )
        )
        .addSubcommand((s) =>
          s.setName('canal-formulario').setDescription('Canal fixo do formulário (opcional)')
            .addChannelOption((o) =>
              o.setName('canal').setDescription('Canal onde os membros abrem o formulário')
                .addChannelTypes(ChannelType.GuildText)
            )
        )
        .addSubcommand((s) =>
          s.setName('opcoes').setDescription('Ativar/desativar opções do fluxo de setagem')
            .addStringOption((o) =>
              o.setName('opcao').setDescription('Opção a alternar').setRequired(true).addChoices(
                { name: 'Aprovação obrigatória (recomendado)', value: 'require_approval' },
                { name: 'Dar cargo do Discord ao aprovar', value: 'role_assignment' },
                { name: 'Enviar DM ao usuário com o resultado', value: 'dm_enabled' }
              )
            )
            .addBooleanOption((o) =>
              o.setName('valor').setDescription('Ligar (true) ou desligar (false)').setRequired(true)
            )
        )
    )
    .addSubcommand((s) => s.setName('ver').setDescription('Visualizar configurações atuais')),

  async autocomplete(interaction) {
    const gid = interaction.guild.id;
    const f = interaction.options.getFocused(true);
    if (f.name === 'tag') {
      const q = (f.value || '').toUpperCase();
      const cargos = await getCargos(gid);
      const match = cargos
        .filter((c) => !q || c.tag.includes(q) || c.nome.toUpperCase().includes(q))
        .slice(0, 24)
        .map((c) => ({ name: `${c.nome} [${c.tag}]`, value: c.tag }));
      return interaction.respond(match);
    }
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const group = interaction.options.getSubcommandGroup();
    const gid = interaction.guild.id;
    const cfg = await getGuildConfig(gid);

    async function buscarCanaisEEnviar(cfgFinal) {
      const carregar = async (id) => {
        if (!id) return '❌ Não definido';
        try {
          const c = await interaction.guild.channels.fetch(id).catch(() => null);
          return c ? `<#${c.id}>` : `❌ Canal ${id} não encontrado`;
        } catch {
          return `❌ Canal ${id} inexistente`;
        }
      };
      const [approval, log, form] = await Promise.all([
        carregar(cfgFinal.set_approval_channel_id),
        carregar(cfgFinal.set_log_channel_id),
        carregar(cfgFinal.set_form_channel_id),
      ]);
      const cargos = await getCargos(gid);
      return { cargos, canais: { approval, log, form } };
    }

    async function responderAtualizado(texto) {
      const c = await getGuildConfig(gid);
      const { cargos, canais } = await buscarCanaisEEnviar(c);
      return interaction.reply({
        content: `✅ ${texto}`,
        embeds: [criarEmbedConfig(c, cargos, canais)],
        ephemeral: true,
      });
    }

    if (sub === 'ver') {
      const { cargos, canais } = await buscarCanaisEEnviar(cfg);
      return interaction.reply({ embeds: [criarEmbedConfig(cfg, cargos, canais)], ephemeral: true });
    }

    if (sub === 'bot') {
      const modal = new ModalBuilder().setCustomId(MODAL_BOT).setTitle('Configurar Nome e Modelo do Bot');
      const row1 = new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('bot_name').setLabel('Nome do Bot').setValue(cfg.bot_name)
          .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50)
      );
      const row2 = new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('bot_model').setLabel('Versão / Modelo').setValue(cfg.bot_model)
          .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50)
      );
      modal.addComponents(row1, row2);
      return interaction.showModal(modal);
    }

    if (sub === 'apelido') {
      const modal = new ModalBuilder().setCustomId(MODAL_NICK).setTitle('Modelo de Apelido');
      const row1 = new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('nickname_template').setLabel('Template do apelido')
          .setValue(cfg.nickname_template).setPlaceholder('[TAG] NOME | ID')
          .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)
      );
      modal.addComponents(row1);
      return interaction.showModal(modal);
    }

    if (sub === 'addcargo') {
      const modal = new ModalBuilder().setCustomId(MODAL_ADD_CARGO).setTitle('Adicionar Cargo');
      const row1 = new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('cargo_nome').setLabel('Nome do cargo (ex: Membro)')
          .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(30)
      );
      const row2 = new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('cargo_tag').setLabel('TAG (ex: MBR)')
          .setPlaceholder('3-5 letras maiúsculas')
          .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(10)
      );
      modal.addComponents(row1, row2);
      return interaction.showModal(modal);
    }

    if (sub === 'vincularcargo') {
      const tag = interaction.options.getString('tag');
      const role = interaction.options.getRole('cargo');
      const cargo = await getCargoByTag(gid, tag);
      if (!cargo) {
        return interaction.reply({ content: `❌ TAG \`${tag}\` não encontrada. Use \`/config addcargo\` primeiro.`, ephemeral: true });
      }
      await updateCargoDiscordRole(gid, tag, role.id);
      return responderAtualizado(`TAG [${tag}] vinculada ao cargo <@&${role.id}>.`);
    }

    if (sub === 'removercargo') {
      const valor = interaction.options.getString('valor');
      const res = await removeCargo(gid, valor);
      if (res.changes > 0) return responderAtualizado(`Cargo \`${valor}\` removido.`);
      return interaction.reply({
        content: `❌ Nenhum cargo encontrado com nome ou tag \`${valor}\`.`,
        ephemeral: true,
      });
    }

    if (group === 'formulario') {
      if (sub === 'texto') {
        const modal = new ModalBuilder().setCustomId(MODAL_FORM_TEXTO).setTitle('Formulário - Texto');
        const r1 = new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('set_form_title').setLabel('Título')
            .setValue(cfg.set_form_title || 'Formulário de Setagem')
            .setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(60)
        );
        const r2 = new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('set_form_description').setLabel('Descrição')
            .setValue(cfg.set_form_description || '')
            .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(800)
        );
        const r3 = new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('set_form_color').setLabel('Cor (HEX)')
            .setValue(cfg.set_form_color || '#ff0040')
            .setPlaceholder('#ff0040').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(9)
        );
        const r4 = new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('set_form_footer').setLabel('Rodapé / texto pequeno')
            .setValue(cfg.set_form_footer || '')
            .setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(120)
        );
        modal.addComponents(r1, r2, r3, r4);
        return interaction.showModal(modal);
      }

      if (sub === 'mensagempv') {
        const modal = new ModalBuilder().setCustomId(MODAL_FORM_DM).setTitle('Mensagem da DM');
        const r1 = new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('set_form_dm_message').setLabel('Mensagem enviada na DM')
            .setValue(cfg.set_form_dm_message || '')
            .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1200)
        );
        modal.addComponents(r1);
        return interaction.showModal(modal);
      }

      if (sub === 'imagem') {
        const modal = new ModalBuilder().setCustomId(MODAL_FORM_IMAGEM).setTitle('Imagem do Formulário');
        const r1 = new ActionRowBuilder().addComponents(
          new TextInputBuilder().setCustomId('set_form_image').setLabel('URL da imagem (PNG/JPG)')
            .setValue(cfg.set_form_image || '')
            .setPlaceholder('https://.../banner.png').setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(600)
        );
        modal.addComponents(r1);
        return interaction.showModal(modal);
      }

      if (sub === 'canal-aprovacao') {
        const ch = interaction.options.getChannel('canal');
        await updateGuildConfig(gid, { set_approval_channel_id: ch.id });
        return responderAtualizado(`Canal de aprovação definido: <#${ch.id}>.`);
      }

      if (sub === 'canal-log') {
        const ch = interaction.options.getChannel('canal');
        await updateGuildConfig(gid, { set_log_channel_id: ch.id });
        return responderAtualizado(`Canal de log definido: <#${ch.id}>.`);
      }

      if (sub === 'canal-formulario') {
        const ch = interaction.options.getChannel('canal');
        await updateGuildConfig(gid, { set_form_channel_id: ch?.id || null });
        return responderAtualizado(`Canal do formulário ${ch ? 'definido: <#' + ch.id + '>' : 'limpo'}.`);
      }

      if (sub === 'opcoes') {
        const op = interaction.options.getString('opcao');
        const val = interaction.options.getBoolean('valor');
        const map = {
          require_approval: 'set_form_require_approval',
          role_assignment: 'set_form_role_assignment',
          dm_enabled: 'set_form_dm_enabled',
        };
        await updateGuildConfig(gid, { [map[op]]: val ? 1 : 0 });
        return responderAtualizado(`Opção \`${op}\` = ${val ? '✅ Ligado' : '❌ Desligado'}.`);
      }
    }
  },

  async handleModal(interaction) {
    const gid = interaction.guild.id;
    const id = interaction.customId;

    if (id === MODAL_BOT) {
      const bot_name = interaction.fields.getTextInputValue('bot_name').trim();
      const bot_model = interaction.fields.getTextInputValue('bot_model').trim();
      await updateGuildConfig(gid, { bot_name, bot_model });
      const cfg = await getGuildConfig(gid);
      const cargos = await getCargos(gid);
      return interaction.reply({
        content: '✅ Configurações do bot atualizadas!',
        embeds: [criarEmbedConfig(cfg, cargos)],
        ephemeral: true,
      });
    }

    if (id === MODAL_NICK) {
      const tpl = interaction.fields.getTextInputValue('nickname_template').trim();
      if (!tpl.includes('{NOME}')) {
        return interaction.reply({ content: '❌ O template precisa conter a variável `{NOME}`.', ephemeral: true });
      }
      await updateGuildConfig(gid, { nickname_template: tpl });
      const cfg = await getGuildConfig(gid);
      const cargos = await getCargos(gid);
      return interaction.reply({
        content: '✅ Modelo de apelido atualizado!',
        embeds: [criarEmbedConfig(cfg, cargos)],
        ephemeral: true,
      });
    }

    if (id === MODAL_ADD_CARGO) {
      const nome = interaction.fields.getTextInputValue('cargo_nome').trim();
      let tag = interaction.fields.getTextInputValue('cargo_tag').trim().toUpperCase();
      tag = tag.replace(/\[|\]/g, '');
      try {
        await addCargo(gid, nome, tag);
        const cfg = await getGuildConfig(gid);
        const cargos = await getCargos(gid);
        return interaction.reply({
          content: `✅ Cargo **${nome}** [${tag}] adicionado!\n> Dica: Vincule um cargo real do Discord com \`/config vincularcargo tag:${tag}\` para ele ser dado ao aprovar.`,
          embeds: [criarEmbedConfig(cfg, cargos)],
          ephemeral: true,
        });
      } catch (e) {
        return interaction.reply({ content: '❌ Já existe um cargo com este nome ou TAG.', ephemeral: true });
      }
    }

    if (id === MODAL_FORM_TEXTO) {
      const title = interaction.fields.getTextInputValue('set_form_title').trim();
      const desc = interaction.fields.getTextInputValue('set_form_description').trim();
      const color = interaction.fields.getTextInputValue('set_form_color').trim();
      const footer = interaction.fields.getTextInputValue('set_form_footer')?.trim() || null;
      const validColor = /^#([0-9A-Fa-f]{6})$/.test(color) ? color : '#ff0040';
      await updateGuildConfig(gid, {
        set_form_title: title,
        set_form_description: desc,
        set_form_color: validColor,
        set_form_footer: footer,
      });
      const cfg = await getGuildConfig(gid);
      const cargos = await getCargos(gid);
      return interaction.reply({
        content: '✅ Texto do formulário atualizado!',
        embeds: [criarEmbedConfig(cfg, cargos)],
        ephemeral: true,
      });
    }

    if (id === MODAL_FORM_DM) {
      const msg = interaction.fields.getTextInputValue('set_form_dm_message').trim();
      await updateGuildConfig(gid, { set_form_dm_message: msg });
      const cfg = await getGuildConfig(gid);
      const cargos = await getCargos(gid);
      return interaction.reply({
        content: '✅ Mensagem da DM atualizada!',
        embeds: [criarEmbedConfig(cfg, cargos)],
        ephemeral: true,
      });
    }

    if (id === MODAL_FORM_IMAGEM) {
      const img = interaction.fields.getTextInputValue('set_form_image')?.trim() || null;
      if (img && !/^https?:\/\//i.test(img)) {
        return interaction.reply({ content: '❌ A imagem precisa ser uma URL (https://...)', ephemeral: true });
      }
      await updateGuildConfig(gid, { set_form_image: img });
      const cfg = await getGuildConfig(gid);
      const cargos = await getCargos(gid);
      return interaction.reply({
        content: img ? '✅ Imagem atualizada!' : '✅ Imagem removida.',
        embeds: [criarEmbedConfig(cfg, cargos)],
        ephemeral: true,
      });
    }
  },
};
