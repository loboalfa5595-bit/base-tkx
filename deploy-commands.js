require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const GUILD_IDS = [
  '1331027702857072791',
  '1540306960795312229',
];

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

for (const file of commandFiles) {
  const cmd = require(path.join(commandsPath, file));
  if ('data' in cmd) commands.push(cmd.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
const clientId = process.env.CLIENT_ID;

(async () => {
  try {
    console.log(`Registrando ${commands.length} comandos em ${GUILD_IDS.length} servidores...`);
    for (const gid of GUILD_IDS) {
      try {
        const data = await rest.put(
          Routes.applicationGuildCommands(clientId, gid),
          { body: commands }
        );
        console.log(`✅ [OK] Servidor ${gid}: ${data.length} comandos registrados`);
      } catch (err) {
        console.log(`❌ [FALHA] Servidor ${gid}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error('Erro geral:', err);
  }
})();
