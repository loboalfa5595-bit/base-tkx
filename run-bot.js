require('dotenv').config();
const fs = require('fs');
const fs2 = require('fs');
const path2 = require('path');
const envLocalPath = path2.join(__dirname, '.env.local');
if (fs2.existsSync(envLocalPath)) {
  const extra = require('dotenv').parse(fs2.readFileSync(envLocalPath));
  for (const k of Object.keys(extra)) {
    if (!process.env[k]) process.env[k] = extra[k];
  }
}

const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const db = require('./database');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));
for (const file of commandFiles) {
  const cmd = require(path.join(commandsPath, file));
  if ('data' in cmd && 'execute' in cmd) {
    client.commands.set(cmd.data.name, cmd);
    console.log(`   ✅ comando carregado: /${cmd.data.name}`);
  }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'));
for (const file of eventFiles) {
  const evt = require(path.join(eventsPath, file));
  if (evt.once) client.once(evt.name, (...args) => evt.execute(...args, client));
  else client.on(evt.name, (...args) => evt.execute(...args, client));
}

client.guildData = { init: (guildId) => db.initGuild(guildId) };

process.on('unhandledRejection', (r) => console.error('UNHANDLED:', r));
process.on('uncaughtException', (e) => console.error('EXCEPTION:', e));

(async function bootstrap() {
  try {
    await db.open();
    console.log('✅ DB carregado');
    await client.login(process.env.DISCORD_TOKEN);
    console.log('✅ Login efetuado. Bot vai ficar online por ate 2 minutos.');
    setTimeout(() => { console.log('⏱️ Encerrando sessao de diagnostico...'); process.exit(0); }, 120_000);
  } catch (err) {
    console.error('FALHA:', err);
    process.exit(1);
  }
})();
