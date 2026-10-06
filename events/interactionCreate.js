const { Events } = require('discord.js');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    try {
      if (interaction.isChatInputCommand()) {
        const cmd = client.commands.get(interaction.commandName);
        if (!cmd) {
          return interaction
            .reply({
              content: '❌ Este comando não está registrado no bot. Tente novamente em alguns segundos.',
              ephemeral: true,
            })
            .catch(() => {});
        }
        try {
          if (!interaction.deferred && !interaction.replied) {
            try {
              await cmd.execute(interaction, client);
            } catch (err) {
              if (!interaction.deferred && !interaction.replied) {
                await interaction
                  .reply({
                    content:
                      '❌ Erro ao executar: ```' +
                      String(err.message || err).slice(0, 1800) +
                      '```',
                    ephemeral: true,
                  })
                  .catch(() => {});
              } else {
                await interaction
                  .followUp({
                    content:
                      '❌ Erro: ```' +
                      String(err.message || err).slice(0, 1800) +
                      '```',
                    ephemeral: true,
                  })
                  .catch(() => {});
              }
              console.error('[CMD ERRO]', interaction.commandName, err);
            }
          }
        } catch (topErr) {
          console.error('[TOP LEVEL interactionCreate cmd]', topErr);
        }
        return;
      }

      if (interaction.isAutocomplete()) {
        const cmd = client.commands.get(interaction.commandName);
        if (!cmd) return;
        if (typeof cmd.autocomplete === 'function') {
          try {
            await cmd.autocomplete(interaction, client);
            return;
          } catch (err) {
            console.error('[AUTOCOMPLETE ERRO]', interaction.commandName, err);
            return;
          }
        }
        if (typeof cmd.handleAutocomplete === 'function') {
          try {
            await cmd.handleAutocomplete(interaction, client);
          } catch (err) {
            console.error('[HANDLE AUTOCOMPLETE ERRO]', interaction.commandName, err);
          }
        }
        return;
      }

      if (interaction.isButton()) {
        let handled = false;
        for (const cmd of client.commands.values()) {
          if (typeof cmd.handleButton === 'function') {
            try {
              const result = await cmd.handleButton(interaction, client);
              if (result === true) {
                handled = true;
                break;
              }
            } catch (err) {
              console.error('[BUTTON ERRO]', interaction.customId, err);
              if (!interaction.replied && !interaction.deferred) {
                try {
                  await interaction
                    .reply({
                      content:
                        '❌ Erro ao processar botão: ```' +
                        String(err.message || err).slice(0, 1800) +
                        '```',
                      ephemeral: true,
                    })
                    .catch(() => {});
                } catch (_) {}
                handled = true;
                break;
              }
            }
          }
        }
        if (!handled && !interaction.replied && !interaction.deferred) {
          await interaction
            .reply({ content: '⏹️ Este botão expirou ou não é válido.', ephemeral: true })
            .catch(() => {});
        }
        return;
      }

      if (interaction.isStringSelectMenu()) {
        let handled = false;
        for (const cmd of client.commands.values()) {
          if (typeof cmd.handleSelectMenu === 'function') {
            try {
              const result = await cmd.handleSelectMenu(interaction, client);
              if (result === true) {
                handled = true;
                break;
              }
            } catch (err) {
              console.error('[SELECT MENU ERRO]', interaction.customId, err);
              if (!interaction.replied && !interaction.deferred) {
                try {
                  await interaction
                    .reply({
                      content:
                        '❌ Erro ao processar menu: ```' +
                        String(err.message || err).slice(0, 1800) +
                        '```',
                      ephemeral: true,
                    })
                    .catch(() => {});
                } catch (_) {}
                handled = true;
                break;
              }
            }
          }
        }
        if (!handled && !interaction.replied && !interaction.deferred) {
          await interaction
            .reply({ content: '⏹️ Este menu expirou ou não é válido.', ephemeral: true })
            .catch(() => {});
        }
        return;
      }

      if (interaction.isModalSubmit()) {
        const prefix = interaction.customId.split(':')[0];
        const cmd = client.commands.get(prefix);
        if (cmd && typeof cmd.handleModal === 'function') {
          try {
            await cmd.handleModal(interaction, client);
          } catch (err) {
            console.error('[MODAL ERRO]', interaction.customId, err);
            const payload = {
              content:
                '❌ Erro ao processar formulário: ```' +
                String(err.message || err).slice(0, 1800) +
                '```',
              ephemeral: true,
            };
            if (interaction.replied || interaction.deferred) {
              await interaction.followUp(payload).catch(() => {});
            } else {
              await interaction.reply(payload).catch(() => {});
            }
          }
          return;
        }
        if (!interaction.replied && !interaction.deferred) {
          await interaction
            .reply({ content: '⏹️ Formulário inválido ou comando não encontrado.', ephemeral: true })
            .catch(() => {});
        }
        return;
      }
    } catch (e) {
      console.error('[interactionCreate CRASH]', e);
      if (!interaction.replied && !interaction.deferred) {
        await interaction
          .reply({
            content: '⚠️ Erro crítico no tratamento da interação.',
            ephemeral: true,
          })
          .catch(() => {});
      }
    }
  },
};
