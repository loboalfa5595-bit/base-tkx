const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ComponentType,
} = require('discord.js');

const CATEGORIAS = {
  admin: {
    titulo: '⚙️ Administração do Servidor',
    cor: '#e74c3c',
    comandos: [
      { nome: '/servidor renomear', desc: 'Mudar o nome do servidor', uso: '/servidor renomear nome:Novo Nome' },
      { nome: '/servidor icone', desc: 'Alterar ícone do servidor via URL', uso: '/servidor icone url:https://...' },
      { nome: '/servidor banner', desc: 'Alterar banner (nível 2+)', uso: '/servidor banner url:https://...' },
      { nome: '/servidor descricao', desc: 'Definir descrição do servidor', uso: '/servidor descricao texto:Olá...' },
      { nome: '/servidor info', desc: 'Painel com todas as informações', uso: '/servidor info' },
      { nome: '/canal criar texto', desc: 'Criar canal de texto', uso: '/canal criar texto nome:geral' },
      { nome: '/canal criar voz', desc: 'Criar canal de voz', uso: '/canal criar voz nome:Sala 1' },
      { nome: '/canal criar categoria', desc: 'Criar uma categoria', uso: '/canal criar categoria nome:Informação' },
      { nome: '/canal criar noticias', desc: 'Criar canal de anúncios', uso: '/canal criar noticias nome:anuncios' },
      { nome: '/canal criar forum', desc: 'Criar canal de fórum', uso: '/canal criar forum nome:Sugestões' },
      { nome: '/canal editar nome', desc: 'Renomear canal/categoria', uso: '/canal editar nome canal:#geral novo_nome:bate-papo' },
      { nome: '/canal editar mover', desc: 'Mover canal para outra categoria', uso: '/canal editar mover canal:#geral categoria:#Informação' },
      { nome: '/canal deletar', desc: 'Excluir canal ou categoria', uso: '/canal deletar canal:#excluir' },
      { nome: '/canal listar', desc: 'Listar todos os canais organizados', uso: '/canal listar' },
    ],
  },
  mensagens: {
    titulo: '💬 Mensagens e Comunicação',
    cor: '#3498db',
    comandos: [
      { nome: '/mensagem enviar', desc: 'Bot envia mensagem normal para um canal', uso: '/mensagem enviar canal:#geral texto:Olá mundo' },
      { nome: '/mensagem embed', desc: 'Envia embed customizável com título/descrição/cor', uso: '/mensagem embed canal:#anuncios titulo:Bem-vindos descricao:Sejam...' },
      { nome: '/mensagem limpar', desc: 'Apaga até 100 mensagens (de até 14 dias)', uso: '/mensagem limpar quantidade:50' },
      { nome: '/mensagem editar', desc: 'Editar uma mensagem antiga do bot', uso: '/mensagem editar canal:#geral mensagem_id:123456 novo_texto:oi' },
      { nome: '/mensagem dm', desc: 'Envia DM para um usuário via bot (anônima ou não)', uso: '/mensagem dm usuario:@João texto:Olá!' },
    ],
  },
  cargos: {
    titulo: '🏷️ Cargos e Permissões',
    cor: '#9b59b6',
    comandos: [
      { nome: '/cargo criar simples', desc: 'Criar cargo com cor/nome/opções', uso: '/cargo criar simples nome:Vip cor:Roxo' },
      { nome: '/cargo dar membro', desc: 'Atribuir cargo a um membro', uso: '/cargo dar membro usuario:@João cargo:@Vip' },
      { nome: '/cargo dar todos', desc: 'Dar um cargo a todos os membros (cuidado!)', uso: '/cargo dar todos cargo:@Membro' },
      { nome: '/cargo remover membro', desc: 'Retirar cargo de um membro', uso: '/cargo remover membro usuario:@João cargo:@Vip' },
      { nome: '/cargo editar', desc: 'Editar nome/cor de cargo', uso: '/cargo editar cargo:@Vip novo_nome:VIP Gold' },
      { nome: '/cargo deletar', desc: 'Excluir um cargo do servidor', uso: '/cargo deletar cargo:@Antigo' },
      { nome: '/cargo listar', desc: 'Listar todos os cargos com contagem', uso: '/cargo listar' },
    ],
  },
  mod: {
    titulo: '🛡️ Moderação',
    cor: '#f39c12',
    comandos: [
      { nome: '/mod expulsar', desc: 'Expulsar um membro do servidor', uso: '/mod expulsar usuario:@Chato motivo:Spam' },
      { nome: '/mod banir', desc: 'Banir usuário permanentemente', uso: '/mod banir usuario:@BadBoy motivo:Fake + apagar_msgs:1' },
      { nome: '/mod desbanir', desc: 'Desfazer banimento por ID', uso: '/mod desbanir usuario_id:123456789' },
      { nome: '/mod castigar', desc: 'Timeout de X minutos (até 28 dias)', uso: '/mod castigar usuario:@João minutos:60 motivo:Desrespeito' },
      { nome: '/mod liberar', desc: 'Remover timeout/castigo', uso: '/mod liberar usuario:@João' },
      { nome: '/mod avisar', desc: 'Enviar aviso privado ao membro', uso: '/mod avisar usuario:@João motivo:Por favor, não faça flood' },
      { nome: '/mod registros', desc: 'Ver registros do membro (banimento/castigo)', uso: '/mod registros usuario:@João' },
    ],
  },
  setagem: {
    titulo: '🏷️ Sistema de Setagem',
    cor: '#2ecc71',
    comandos: [
      { nome: '/config ver', desc: 'Ver configurações atuais do servidor', uso: '/config ver' },
      { nome: '/config bot', desc: 'Editar nome e versão do bot (no DB)', uso: '/config bot' },
      { nome: '/config apelido', desc: 'Editar template de apelido ({TAG} {NOME} {ID})', uso: '/config apelido' },
      { nome: '/config addcargo', desc: 'Cadastrar cargo com TAG para setagem', uso: '/config addcargo' },
      { nome: '/config removercargo', desc: 'Remover cargo/tag do sistema', uso: '/config removercargo valor:MBR' },
      { nome: '/setar eu', desc: 'Solicitar sua própria setagem', uso: '/setar eu' },
      { nome: '/setar membro', desc: 'Setar outro membro (staff)', uso: '/setar membro usuario:@João' },
      { nome: '/setar ver', desc: 'Ver dados da setagem', uso: '/setar ver usuario:@João' },
    ],
  },
  ia: {
    titulo: '🤖 Inteligência Artificial',
    cor: '#00d1ff',
    comandos: [
      { nome: '/ai chat', desc: 'Conversar com o GPT diretamente no Discord', uso: '/ai chat pergunta:Explique o que é IA' },
      { nome: '/ai imagem', desc: 'Gerar imagem com DALL·E', uso: '/ai imagem prompt:Um gato astronauta' },
      { nome: '/ai traduzir', desc: 'Traduzir texto (PT/EN/ES/etc)', uso: '/ai traduzir texto:Hello destino:pt' },
      { nome: '/ai resumir', desc: 'Resumir um texto longo', uso: '/ai resumir texto:Texto enorme...' },
    ],
  },
};

const ORDEM = ['admin', 'mensagens', 'cargos', 'mod', 'setagem', 'ia'];

function gerarEmbed(cat) {
  const c = CATEGORIAS[cat];
  if (!c) {
    const fields = ORDEM.map((k) => {
      const cc = CATEGORIAS[k];
      const comandos = cc.comandos.map((x) => `\`${x.nome}\``).join(', ');
      return { name: cc.titulo, value: comandos };
    });
    return new EmbedBuilder()
      .setTitle('📚 Guia de Comandos — AI Studio Bot')
      .setColor('#ff0040')
      .setDescription('Use o menu abaixo para ver detalhes de cada categoria.')
      .addFields(...fields)
      .setFooter({ text: 'Total: comandos disponíveis' })
      .setTimestamp();
  }
  return new EmbedBuilder()
    .setTitle(c.titulo)
    .setColor(c.cor)
    .addFields(
      c.comandos.map((x) => ({
        name: x.nome,
        value: `${x.desc}\n**Ex.:** \`${x.uso}\``,
      }))
    )
    .setFooter({ text: '⚠️ Muitos comandos exigem permissões de ADM/STAFF.' })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ajuda')
    .setDescription('Mostra todos os comandos disponíveis do bot')
    .addStringOption((o) =>
      o.setName('categoria').setDescription('Ver só uma categoria').addChoices(
        ...ORDEM.map((k) => ({ name: CATEGORIAS[k].titulo.replace(/^[^a-zA-ZÀ-ÿ]+/, '').slice(0, 25), value: k }))
      )
    ),

  async execute(interaction) {
    const cat = interaction.options.getString('categoria');

    if (cat) {
      return interaction.reply({ embeds: [gerarEmbed(cat)], ephemeral: true });
    }

    const options = [
      { label: '📋 Visão Geral', description: 'Todos os comandos resumidos', value: 'ALL' },
      ...ORDEM.map((k) => ({
        label: CATEGORIAS[k].titulo.replace(/^[^a-zA-ZÀ-ÿ]/, '').trim().slice(0, 90),
        description: `${CATEGORIAS[k].comandos.length} comandos`,
        value: k,
      })),
    ].slice(0, 25);

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('ajuda:select')
        .setPlaceholder('Selecione uma categoria...')
        .addOptions(options)
    );

    const reply = await interaction.reply({
      embeds: [gerarEmbed(null)],
      components: [row],
      fetchReply: true,
      ephemeral: true,
    });

    try {
      const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.StringSelect,
        filter: (i) => i.customId === 'ajuda:select' && i.user.id === interaction.user.id,
        time: 5 * 60 * 1000,
      });

      collector.on('collect', async (i) => {
        const val = i.values[0];
        const embed = val === 'ALL' ? gerarEmbed(null) : gerarEmbed(val);
        await i.update({ embeds: [embed] });
      });

      collector.on('end', () => {
        interaction.editReply({ components: [] }).catch(() => {});
      });
    } catch (_) {}
  },
};
