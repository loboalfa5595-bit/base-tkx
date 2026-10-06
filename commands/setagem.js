const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ModalBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const {
  open,
  getGuildConfig,
  getCargos,
  getCargoByTag,
  upsertMembro,
} = require('../database');

const MODAL_SETAGEM = 'setagem:modal:aplicar';

function formatarApelido(template, tag, nome, identificador) {
  let s = String(template || '[{TAG}] {NOME} | {ID}');
  s = s.replace(/\{TAG\}/gi, String(tag).toUpperCase());
  s = s.replace(/\{NOME\}/gi, String(nome));
  s = s.replace(/\{ID\}/gi, String(identificador));
  return s.slice(0, 32);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setagem')
    .setDescription('Setar rapidamente um membro: selecione usuário + cargo/tag (Staff)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
    .addUserOption((o) =>
      o.setName('membro').setDescription('Membro que deseja setar').setRequired(true)
    )
    .addStringOption((o) =>
      o.setName('cargo')
        .setDescription('Tag do cargo (MBR, VEN, ADM, etc) — comece a digitar para escolher')
        .setRequired(true)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const gid = interaction.guild.id;
    await open();
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'cargo') {
      const q = (focused.value || '').toUpperCase();
      const cargos = await getCargos(gid);
      const matches = cargos
        .filter((c) => !q || c.tag.toUpperCase().includes(q) || c.nome.toUpperCase().includes(q))
        .slice(0, 25)
        .map((c) => ({ name: `${c.nome} [${c.tag}]`, value: c.tag }));
      return interaction.respond(matches).catch(() => {});
    }
  },

  async execute(interaction) {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)) {
      return interaction.reply({
        content: '❌ Você precisa da permissão **Gerenciar Apelidos** para usar este comando.',
        ephemeral: true,
      });
    }

    const gid = interaction.guild.id;
    const user = interaction.options.getUser('membro', true);
    const tag = (interaction.options.getString('cargo', true) || '').trim().toUpperCase();

    await open();
    const cargo = await getCargoByTag(gid, tag);
    if (!cargo) {
      return interaction.reply({
        content: `❌ Tag **${tag}** não encontrada. Use o autocomplete para selecionar um cargo válido.`,
        ephemeral: true,
      });
    }

    const membroGuild = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!membroGuild) {
      return interaction.reply({ content: '❌ Membro não encontrado no servidor.', ephemeral: true });
    }

    const customId = `${MODAL_SETAGEM}:${membroGuild.id}:${cargo.tag}`;
    const modal = new ModalBuilder().setCustomId(customId).setTitle(`Setagem [${cargo.tag}]`);

    const rowNome = new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('set_nome')
        .setLabel('Nome do membro')
        .setPlaceholder('Ex: João Silva')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(80)
        .setValue(membroGuild.nickname ? membroGuild.nickname.replace(/^\[[^\]]+\]\s*/, '').replace(/\s*\|.*/, '').trim() : membroGuild.user.username)
    );
    const rowId = new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('set_id')
        .setLabel('Identificador / ID')
        .setPlaceholder('Ex: 007, 12-A, MEC-99')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(30)
        .setValue('001')
    );

    modal.addComponents(rowNome, rowId);
    return interaction.showModal(modal);
  },

  async handleModal(interaction) {
    const parts = interaction.customId.split(':');
    if (parts[0] !== 'setagem' || parts[1] !== 'modal') return false;

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames)) {
      await interaction.reply({ content: '❌ Sem permissão para finalizar a setagem.', ephemeral: true });
      return true;
    }

    const userId = parts[2];
    const tag = (parts[3] || '').toUpperCase();
    const nome = (interaction.fields.getTextInputValue('set_nome') || '').trim();
    const identificador = (interaction.fields.getTextInputValue('set_id') || '').trim();
    const gid = interaction.guild.id;

    await open();
    const cfg = await getGuildConfig(gid);
    const cargo = await getCargoByTag(gid, tag);

    if (!cargo) {
      await interaction.reply({ content: '❌ Tag do cargo inválida.', ephemeral: true });
      return true;
    }
    if (!nome || !identificador) {
      await interaction.reply({ content: '❌ Nome e identificador são obrigatórios.', ephemeral: true });
      return true;
    }

    const membroGuild = await interaction.guild.members.fetch(userId).catch(() => null);
    if (!membroGuild) {
      await interaction.reply({ content: '❌ Membro não encontrado no servidor.', ephemeral: true });
      return true;
    }

    const apelido = formatarApelido(cfg.nickname_template, tag, nome, identificador);

    try {
      await interaction.deferReply({ ephemeral: false });
    } catch (_) {}

    const erros = [];
    try {
      await membroGuild.setNickname(apelido, `Setagem por ${interaction.user.tag} via /setagem`);
    } catch (e) {
      erros.push(`Não foi possível alterar o apelido: ${e.message}`);
    }

    let cargoDiscordAplicado = null;
    if (cfg.set_form_role_assignment === 1 && cargo.discord_role_id) {
      try {
        await membroGuild.roles.add(cargo.discord_role_id, `Setagem [${tag}] por ${interaction.user.tag}`);
        cargoDiscordAplicado = cargo.discord_role_id;
      } catch (e) {
        erros.push(`Não foi possível dar o cargo Discord: ${e.message}`);
      }
    }

    try {
      await upsertMembro({
        user_id: userId,
        guild_id: gid,
        nome,
        identificador,
        cargo_tag: tag,
        approved_by: interaction.user.id,
        approved_at: new Date().toISOString(),
      });
    } catch (e) {
      erros.push(`Erro ao salvar no banco: ${e.message}`);
    }

    const embed = new EmbedBuilder()
      .setTitle('✅ Setagem aplicada com sucesso')
      .setColor('#ff0040')
      .addFields(
        { name: '👤 Membro', value: `${membroGuild} (\`${userId}\`)`, inline: true },
        { name: '🏷️ Cargo / TAG', value: `\`${tag}\` (${cargo.nome})`, inline: true },
        { name: '📝 Nome', value: nome, inline: true },
        { name: '🆔 ID', value: identificador, inline: true },
        { name: '✏️ Apelido aplicado', value: `\`${apelido}\``, inline: false },
      )
      .setFooter({ text: `Aplicado por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    if (cargoDiscordAplicado) {
      embed.addFields({ name: '🎖️ Cargo Discord', value: `<@&${cargoDiscordAplicado}>`, inline: false });
    }
    if (erros.length) {
      embed.addFields({ name: '⚠️ Observações', value: erros.map((m) => `- ${m}`).join('\n').slice(0, 1024), inline: false });
    }

    try {
      await interaction.editReply({ embeds: [embed] });
    } catch (_) {
      await interaction.reply({ embeds: [embed], ephemeral: false }).catch(() => {});
    }

    return true;
  },
};
