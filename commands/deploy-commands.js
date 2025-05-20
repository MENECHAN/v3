const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const config = require('../config.json');

const commands = [
    new SlashCommandBuilder()
        .setName('send-panel')
        .setDescription('Envia o painel principal do shop')
        .setDefaultMemberPermissions(0),

    new SlashCommandBuilder()
        .setName('account')
        .setDescription('Gerencia contas do sistema')
        .setDefaultMemberPermissions(0)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Adiciona uma nova conta')
                .addStringOption(option =>
                    option.setName('nickname')
                        .setDescription('Nickname da conta')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('rp')
                        .setDescription('Quantidade de RP')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('friends')
                        .setDescription('Quantidade de amigos atual')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('region')
                        .setDescription('Região da conta')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Brasil (BR)', value: 'BR' },
                            { name: 'América do Norte (NA)', value: 'NA' },
                            { name: 'Europa Oeste (EUW)', value: 'EUW' },
                            { name: 'Europa Nordeste (EUNE)', value: 'EUNE' },
                            { name: 'América Latina Sul (LAS)', value: 'LAS' },
                            { name: 'América Latina Norte (LAN)', value: 'LAN' },
                            { name: 'Oceania (OCE)', value: 'OCE' },
                            { name: 'Japão (JP)', value: 'JP' },
                            { name: 'Coreia (KR)', value: 'KR' },
                            { name: 'Turquia (TR)', value: 'TR' },
                            { name: 'Rússia (RU)', value: 'RU' }
                        )
                )
                .addIntegerOption(option =>
                    option.setName('max_friends')
                        .setDescription('Quantidade máxima de amigos (padrão: 250)')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove uma conta')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('ID da conta')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Edita uma conta')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('ID da conta')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('nickname')
                        .setDescription('Novo nickname')
                        .setRequired(false)
                )
                .addIntegerOption(option =>
                    option.setName('rp')
                        .setDescription('Nova quantidade de RP')
                        .setRequired(false)
                )
                .addIntegerOption(option =>
                    option.setName('friends')
                        .setDescription('Nova quantidade de amigos')
                        .setRequired(false)
                )
                .addIntegerOption(option =>
                    option.setName('max_friends')
                        .setDescription('Nova quantidade máxima de amigos')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Lista todas as contas')
                .addStringOption(option =>
                    option.setName('region')
                        .setDescription('Filtrar por região')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Brasil (BR)', value: 'BR' },
                            { name: 'América do Norte (NA)', value: 'NA' },
                            { name: 'Europa Oeste (EUW)', value: 'EUW' },
                            { name: 'Europa Nordeste (EUNE)', value: 'EUNE' },
                            { name: 'América Latina Sul (LAS)', value: 'LAS' },
                            { name: 'América Latina Norte (LAN)', value: 'LAN' },
                            { name: 'Oceania (OCE)', value: 'OCE' },
                            { name: 'Japão (JP)', value: 'JP' },
                            { name: 'Coreia (KR)', value: 'KR' },
                            { name: 'Turquia (TR)', value: 'TR' },
                            { name: 'Rússia (RU)', value: 'RU' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('region')
                .setDescription('Gerencia região de uma conta')
                .addIntegerOption(option =>
                    option.setName('id')
                        .setDescription('ID da conta')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('region')
                        .setDescription('Nova região da conta')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Brasil (BR)', value: 'BR' },
                            { name: 'América do Norte (NA)', value: 'NA' },
                            { name: 'Europa Oeste (EUW)', value: 'EUW' },
                            { name: 'Europa Nordeste (EUNE)', value: 'EUNE' },
                            { name: 'América Latina Sul (LAS)', value: 'LAS' },
                            { name: 'América Latina Norte (LAN)', value: 'LAN' },
                            { name: 'Oceania (OCE)', value: 'OCE' },
                            { name: 'Japão (JP)', value: 'JP' },
                            { name: 'Coreia (KR)', value: 'KR' },
                            { name: 'Turquia (TR)', value: 'TR' },
                            { name: 'Rússia (RU)', value: 'RU' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('region-stats')
                .setDescription('Exibe estatísticas de contas por região')
        ),

    new SlashCommandBuilder()
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
                .setName('cleanup')
                .setDescription('Remove backups antigos')
                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('Remover backups mais antigos que X dias (padrão: 7)')
                        .setRequired(false)
                )
        ),

    new SlashCommandBuilder()
        .setName('friendship-admin')
        .setDescription('Comandos administrativos para amizades (TESTES)')
        .setDefaultMemberPermissions(0)
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-date')
                .setDescription('Alterar data de uma amizade específica')
                .addIntegerOption(option =>
                    option.setName('friendship_id')
                        .setDescription('ID da amizade')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('days_ago')
                        .setDescription('Quantos dias atrás (ex: 7 = 7 dias atrás)')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(365)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list-user')
                .setDescription('Listar amizades de um usuário')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário para verificar')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('region')
                        .setDescription('Filtrar por região')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Brasil (BR)', value: 'BR' },
                            { name: 'América do Norte (NA)', value: 'NA' },
                            { name: 'Europa Oeste (EUW)', value: 'EUW' },
                            { name: 'Europa Nordeste (EUNE)', value: 'EUNE' },
                            { name: 'América Latina Sul (LAS)', value: 'LAS' },
                            { name: 'América Latina Norte (LAN)', value: 'LAN' },
                            { name: 'Oceania (OCE)', value: 'OCE' },
                            { name: 'Japão (JP)', value: 'JP' },
                            { name: 'Coreia (KR)', value: 'KR' },
                            { name: 'Turquia (TR)', value: 'TR' },
                            { name: 'Rússia (RU)', value: 'RU' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset-notifications')
                .setDescription('Resetar notificações de um usuário específico')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário para resetar')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('force-notification')
                .setDescription('Forçar notificação de uma amizade')
                .addIntegerOption(option =>
                    option.setName('friendship_id')
                        .setDescription('ID da amizade')
                        .setRequired(true)
                )
        ),

    new SlashCommandBuilder()
        .setName('price-manage')
        .setDescription('Gerencia preços do sistema')
        .setDefaultMemberPermissions(0)
        .addSubcommand(subcommand =>
            subcommand
                .setName('prices')
                .setDescription('Mostra painel de gerenciamento de preços')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit-item')
                .setDescription('Edita o preço de um item específico')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset-prices')
                .setDescription('Reseta todos os preços para o padrão')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('export-config')
                .setDescription('Exporta configuração de preços')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('import-config')
                .setDescription('Importa configuração de preços')
        ),

    // Comando de logs de amizades
    new SlashCommandBuilder()
        .setName('friendship-logs')
        .setDescription('Mostra logs e estatísticas de amizades')
        .setDefaultMemberPermissions(0)
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Estatísticas gerais de amizades')
                .addStringOption(option =>
                    option.setName('region')
                        .setDescription('Filtrar por região')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Brasil (BR)', value: 'BR' },
                            { name: 'América do Norte (NA)', value: 'NA' },
                            { name: 'Europa Oeste (EUW)', value: 'EUW' },
                            { name: 'Europa Nordeste (EUNE)', value: 'EUNE' },
                            { name: 'América Latina Sul (LAS)', value: 'LAS' },
                            { name: 'América Latina Norte (LAN)', value: 'LAN' },
                            { name: 'Oceania (OCE)', value: 'OCE' },
                            { name: 'Japão (JP)', value: 'JP' },
                            { name: 'Coreia (KR)', value: 'KR' },
                            { name: 'Turquia (TR)', value: 'TR' },
                            { name: 'Rússia (RU)', value: 'RU' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('recent')
                .setDescription('Amizades recentes')
                .addIntegerOption(option =>
                    option.setName('limit')
                        .setDescription('Número de amizades a mostrar (padrão: 10)')
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option.setName('region')
                        .setDescription('Filtrar por região')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Brasil (BR)', value: 'BR' },
                            { name: 'América do Norte (NA)', value: 'NA' },
                            { name: 'Europa Oeste (EUW)', value: 'EUW' },
                            { name: 'Europa Nordeste (EUNE)', value: 'EUNE' },
                            { name: 'América Latina Sul (LAS)', value: 'LAS' },
                            { name: 'América Latina Norte (LAN)', value: 'LAN' },
                            { name: 'Oceania (OCE)', value: 'OCE' },
                            { name: 'Japão (JP)', value: 'JP' },
                            { name: 'Coreia (KR)', value: 'KR' },
                            { name: 'Turquia (TR)', value: 'TR' },
                            { name: 'Rússia (RU)', value: 'RU' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('user')
                .setDescription('Amizades de um usuário específico')
                .addUserOption(option =>
                    option.setName('usuario')
                        .setDescription('Usuário para verificar')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option.setName('region')
                        .setDescription('Filtrar por região')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Brasil (BR)', value: 'BR' },
                            { name: 'América do Norte (NA)', value: 'NA' },
                            { name: 'Europa Oeste (EUW)', value: 'EUW' },
                            { name: 'Europa Nordeste (EUNE)', value: 'EUNE' },
                            { name: 'América Latina Sul (LAS)', value: 'LAS' },
                            { name: 'América Latina Norte (LAN)', value: 'LAN' },
                            { name: 'Oceania (OCE)', value: 'OCE' },
                            { name: 'Japão (JP)', value: 'JP' },
                            { name: 'Coreia (KR)', value: 'KR' },
                            { name: 'Turquia (TR)', value: 'TR' },
                            { name: 'Rússia (RU)', value: 'RU' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('pending')
                .setDescription('Pedidos de amizade pendentes')
                .addStringOption(option =>
                    option.setName('region')
                        .setDescription('Filtrar por região')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Brasil (BR)', value: 'BR' },
                            { name: 'América do Norte (NA)', value: 'NA' },
                            { name: 'Europa Oeste (EUW)', value: 'EUW' },
                            { name: 'Europa Nordeste (EUNE)', value: 'EUNE' },
                            { name: 'América Latina Sul (LAS)', value: 'LAS' },
                            { name: 'América Latina Norte (LAN)', value: 'LAN' },
                            { name: 'Oceania (OCE)', value: 'OCE' },
                            { name: 'Japão (JP)', value: 'JP' },
                            { name: 'Coreia (KR)', value: 'KR' },
                            { name: 'Turquia (TR)', value: 'TR' },
                            { name: 'Rússia (RU)', value: 'RU' }
                        )
                )
        ),

    // Comando de faturamento
    new SlashCommandBuilder()
        .setName('revenue')
        .setDescription('Mostra estatísticas completas de faturamento da loja')
        .setDefaultMemberPermissions(0)
        .addIntegerOption(option =>
            option.setName('dias')
                .setDescription('Período para analisar (dias, padrão: 30)')
                .setRequired(false)
                .addChoices(
                    { name: 'Últimos 7 dias', value: 7 },
                    { name: 'Últimos 30 dias', value: 30 },
                    { name: 'Últimos 90 dias', value: 90 },
                    { name: 'Ano inteiro', value: 365 }
                )
        )
        .addIntegerOption(option =>
            option.setName('top_clientes')
                .setDescription('Número de top clientes a mostrar (padrão: 5)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(10)
        )
        .addStringOption(option =>
            option.setName('region')
                .setDescription('Filtrar por região')
                .setRequired(false)
                .addChoices(
                    { name: 'Brasil (BR)', value: 'BR' },
                    { name: 'América do Norte (NA)', value: 'NA' },
                    { name: 'Europa Oeste (EUW)', value: 'EUW' },
                    { name: 'Europa Nordeste (EUNE)', value: 'EUNE' },
                    { name: 'América Latina Sul (LAS)', value: 'LAS' },
                    { name: 'América Latina Norte (LAN)', value: 'LAN' },
                    { name: 'Oceania (OCE)', value: 'OCE' },
                    { name: 'Japão (JP)', value: 'JP' },
                    { name: 'Coreia (KR)', value: 'KR' },
                    { name: 'Turquia (TR)', value: 'TR' },
                    { name: 'Rússia (RU)', value: 'RU' }
                )
        ),

    // Comando de notificações de amizade
    new SlashCommandBuilder()
        .setName('friendship-notifications')
        .setDescription('Gerencia notificações de amizade')
        .setDefaultMemberPermissions(0)
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Mostra estatísticas do serviço de notificação')
                .addStringOption(option =>
                    option.setName('region')
                        .setDescription('Filtrar por região')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Brasil (BR)', value: 'BR' },
                            { name: 'América do Norte (NA)', value: 'NA' },
                            { name: 'Europa Oeste (EUW)', value: 'EUW' },
                            { name: 'Europa Nordeste (EUNE)', value: 'EUNE' },
                            { name: 'América Latina Sul (LAS)', value: 'LAS' },
                            { name: 'América Latina Norte (LAN)', value: 'LAN' },
                            { name: 'Oceania (OCE)', value: 'OCE' },
                            { name: 'Japão (JP)', value: 'JP' },
                            { name: 'Coreia (KR)', value: 'KR' },
                            { name: 'Turquia (TR)', value: 'TR' },
                            { name: 'Rússia (RU)', value: 'RU' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('check')
                .setDescription('Verifica amizades elegíveis agora')
                .addStringOption(option =>
                    option.setName('region')
                        .setDescription('Filtrar por região')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Brasil (BR)', value: 'BR' },
                            { name: 'América do Norte (NA)', value: 'NA' },
                            { name: 'Europa Oeste (EUW)', value: 'EUW' },
                            { name: 'Europa Nordeste (EUNE)', value: 'EUNE' },
                            { name: 'América Latina Sul (LAS)', value: 'LAS' },
                            { name: 'América Latina Norte (LAN)', value: 'LAN' },
                            { name: 'Oceania (OCE)', value: 'OCE' },
                            { name: 'Japão (JP)', value: 'JP' },
                            { name: 'Coreia (KR)', value: 'KR' },
                            { name: 'Turquia (TR)', value: 'TR' },
                            { name: 'Rússia (RU)', value: 'RU' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('test')
                .setDescription('Testa notificação para uma amizade específica')
                .addIntegerOption(option =>
                    option.setName('friendship_id')
                        .setDescription('ID da amizade para testar')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('Reseta todas as notificações (CUIDADO!)')
                .addStringOption(option =>
                    option.setName('region')
                        .setDescription('Filtrar por região (deixe em branco para todas)')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Brasil (BR)', value: 'BR' },
                            { name: 'América do Norte (NA)', value: 'NA' },
                            { name: 'Europa Oeste (EUW)', value: 'EUW' },
                            { name: 'Europa Nordeste (EUNE)', value: 'EUNE' },
                            { name: 'América Latina Sul (LAS)', value: 'LAS' },
                            { name: 'América Latina Norte (LAN)', value: 'LAN' },
                            { name: 'Oceania (OCE)', value: 'OCE' },
                            { name: 'Japão (JP)', value: 'JP' },
                            { name: 'Coreia (KR)', value: 'KR' },
                            { name: 'Turquia (TR)', value: 'TR' },
                            { name: 'Rússia (RU)', value: 'RU' }
                        )
                )
        ),
];

const rest = new REST().setToken(config.token);

(async () => {
    try {
        console.log('Started refreshing application (/) commands.');

        await rest.put(
            Routes.applicationGuildCommands(config.clientId, config.guildId),
            { body: commands }
        );

        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();