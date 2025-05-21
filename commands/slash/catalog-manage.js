const { SlashCommandBuilder } = require('discord.js');

// Adicione este comando ao seu deploy-commands.js

const catalogManageCommand = new SlashCommandBuilder()
    .setName('catalog-manage')
    .setDescription('Gerencia o sistema de catálogo')
    .setDefaultMemberPermissions(0)
    .addSubcommand(subcommand =>
        subcommand
            .setName('stats')
            .setDescription('Mostra estatísticas do catálogo atual')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('backup')
            .setDescription('Cria um backup manual do catálogo')
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('upload')
            .setDescription('Faz upload de um novo arquivo catalog.json para formatação.')
            .addAttachmentOption(option => // Opção para anexar o arquivo
                option.setName('catalogfile')
                    .setDescription('O arquivo catalog.json a ser enviado.')
                    .setRequired(true)))
    .addSubcommand(subcommand =>
        subcommand
            .setName('cleanup')
            .setDescription('Remove backups antigos')
            .addIntegerOption(option =>
                option.setName('days')
                    .setDescription('Remover backups mais antigos que X dias (padrão: 7)')
                    .setRequired(false)
            )
    )
    .addSubcommand(subcommand =>
        subcommand
            .setName('export')
            .setDescription('Exporta o catálogo atual')
    );

// Adicione este comando ao array de comandos no deploy-commands.js:
// const commands = [
//     new SlashCommandBuilder()...
//     catalogManageCommand,
//     // outros comandos...
// ]

module.exports = catalogManageCommand;