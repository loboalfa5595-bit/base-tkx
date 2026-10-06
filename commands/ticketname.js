const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');

const OPCOES_STATUS = [
  { name: '🟠 Andamento', value: '🟠' },
  { name: '✅ Concluído', value: '✅' },
  { name: '🟣 Aguardando', value: '🟣' },
  { name: '⛔ Bloqueado', value: '⛔' },
  { name: '❌ Cancelado', value: '❌' },
  { name: '🚩 Prioridade', value: '🚩' },
  { name: '💸 Pagamento', value: '💸' },
];

function limparApelido(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  s = s.replace(/^\[[^\]]+\]\s*/, '');
  s = s.replace(/\s*\|[^|]*$/, '');
  s = s.trim();
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[^a-zA-Z0-9\s-]/g, '');
  s = s.replace(/\s+/g, '-');
  s = s.replace(/-+/g, '-');
  s = s.replace(/^-+|-+$/g, '');
  return s.toLowerCase();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticketname')
    .setDescription('Renomeia o canal atual para o apelido do membro + status (ADM)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addUserOption((o) =>
      o.setName('membro').setDescription('Membro dono do ticket').setRequired(true)
    )
    .addStringOption((o) => {
      o.setName('status').setDescription('Status ao final do nome do canal').setRequired(true);
      for (const op of OPCOES_STATUS) {
        o.addChoices(op);
      }
      return o;
    }),

  async execute(interaction) {
    const canal = interaction.channel;
    const user = interaction.options.getUser('membro');
    const status = interaction.options.getString('status');

    if (
      canal.type !== ChannelType.GuildText &&
      canal.type !== ChannelType.PublicThread &&
      canal.type !== ChannelType.PrivateThread
    ) {
      return interaction.reply({
        content: '❌ Este comando só pode ser usado em canais de texto ou threads.',
        ephemeral: true,
      });
    }

    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({
        content: '❌ Você precisa da permissão **Gerenciar Canais**.',
        ephemeral: true,
      });
    }

    const membroGuild = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!membroGuild) {
      return interaction.reply({ content: '❌ Membro não encontrado no servidor.', ephemeral: true });
    }

    const apelidoBruto = membroGuild.nickname || membroGuild.user.username || membroGuild.user.tag;
    const apelidoLimpo = limparApelido(apelidoBruto);

    if (!apelidoLimpo) {
      return interaction.reply({
        content: '❌ Não foi possível extrair um nome válido do apelido do membro.',
        ephemeral: true,
      });
    }

    const novoNome = `${apelidoLimpo}-${status}`;
    const nomeAntigo = canal.name;

    if (novoNome.length > 100) {
      return interaction.reply({
        content: `❌ Nome resultante muito longo (${novoNome.length} chars, máximo 100).`,
        ephemeral: true,
      });
    }

    try {
      await canal.setName(novoNome, `Renomeado via /ticketname por ${interaction.user.tag}`);
    } catch (e) {
      return interaction.reply({
        content: `❌ Falha ao renomear canal: ${e.message}`,
        ephemeral: true,
      });
    }

    const embed = new EmbedBuilder()
      .setTitle('🎫 Canal renomeado com sucesso!')
      .setColor('#ff0040')
      .addFields(
        { name: '📌 Membro', value: `${membroGuild} (\`${membroGuild.id}\`)`, inline: true },
        { name: '🏷️ Status', value: status, inline: true },
        { name: '↪️ Antes', value: `\`${nomeAntigo}\``, inline: false },
        { name: '➡️ Depois', value: `\`${novoNome}\``, inline: false }
      )
      .setFooter({ text: `Por ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: false });
  },
};
