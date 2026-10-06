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
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.GuildMember,
  ],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));
for (const file of commandFiles) {
  const cmd = require(path.join(commandsPath, file));
  if ('data' in cmd && 'execute' in cmd) {
    client.commands.set(cmd.data.name, cmd);
  }
}

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter((f) => f.endsWith('.js'));
for (const file of eventFiles) {
  const evt = require(path.join(eventsPath, file));
  if (evt.once) {
    client.once(evt.name, (...args) => evt.execute(...args, client));
  } else {
    client.on(evt.name, (...args) => evt.execute(...args, client));
  }
}

client.guildData = {
  init: (guildId) => db.initGuild(guildId),
};

const http = require('http');
const HEALTH_PORT = Number(process.env.PORT) || 10000;
const healthServer = http.createServer((req, res) => {
  const body = JSON.stringify({
    ok: true,
    bot_logged: client.isReady() ? true : false,
    bot_user: client.user ? client.user.tag : null,
    guilds: client.isReady() ? client.guilds.cache.size : 0,
    uptime_s: client.isReady() ? Math.floor(client.uptime / 1000) : 0,
  });
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(body);
});
healthServer.listen(HEALTH_PORT, () => {
  console.log(`[Healthcheck] Servidor HTTP anti-dormir rodando na porta ${HEALTH_PORT}`);
});

(async function bootstrap() {
  try {
    await db.open();
    await client.login(process.env.DISCORD_TOKEN);
  } catch (err) {
    console.error('Falha ao iniciar:', err.message);
    console.log('Verifique se o DISCORD_TOKEN está configurado no arquivo .env');
    process.exit(1);
  }
})();
