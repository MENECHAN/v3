const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionFlagsBits } = require('discord.js');
const PriceManager = require('../../PriceManager'); // Adjust path if PriceManager.js is not two levels up
const fs = require('fs'); // For loading analysis for choices, if desired
const path = require('path');

// Path to your inventory analysis to populate choices for class names
const INVENTORY_ANALYSIS_PATH = path.resolve(__dirname, '../../inventory-analysis-1747600948977.json'); // Adjust path

let inventoryAnalysisData = null;
try {
    if (fs.existsSync(INVENTORY_ANALYSIS_PATH)) {
        inventoryAnalysisData = JSON.parse(fs.readFileSync(INVENTORY_ANALYSIS_PATH, 'utf8'));
    } else {
        console.warn(`Inventory analysis file not found at ${INVENTORY_ANALYSIS_PATH} for price-manage command.`);
    }
} catch (e) {
    console.error("Error loading inventory analysis for price-manage command:", e);
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('price-manage')
        .setDescription('Gerencia os preços dos itens e classes (Admin).')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Ensure only admins can use
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('Visualiza a configuração de preços atual.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-item')
                .setDescription('Define o preço de um item específico (override).')
                .addStringOption(option => option.setName('itemkey').setDescription('ID ou chave única do item (ex: ID do item no catalog.json).').setRequired(true))
                .addIntegerOption(option => option.setName('price').setDescription(`Preço em ${PriceManager.currency}. Deixe em branco ou 0 para remover override.`).setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-class')
                .setDescription('Define o preço padrão para uma classe de itens.')
                .addStringOption(option =>
                    option.setName('class_system')
                        .setDescription('O sistema de classificação (ex: inventoryTypes).')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Inventory Types (Tipos de Inventário)', value: 'inventoryTypes' },
                            { name: 'Item Categories (Categorias de Item)', value: 'itemCategories' },
                            { name: 'SubInventory Types (Subtipos de Inventário)', value: 'subInventoryTypes' }
                        ))
                .addStringOption(option =>
                    option.setName('class_name')
                        .setDescription('Nome da classe (ex: CHAMPION, EPIC_SKIN). Use /price-manage list-classes para ver nomes.')
                        .setRequired(true)
                        .setAutocomplete(true)) // Enable autocomplete
                .addIntegerOption(option => option.setName('price').setDescription(`Preço em ${PriceManager.currency}. Deixe em branco ou 0 para remover.`).setRequired(true))),
        // Optional: Command to list available class names based on analysis or current config
        // .addSubcommand(subcommand =>
        //     subcommand
        //         .setName('list-classes')
        //         .setDescription('Lista os nomes de classes disponíveis para precificação.')
        //         .addStringOption(option =>
        //             option.setName('class_system')
        //                 .setDescription('O sistema de classificação para listar nomes.')
        //                 .setRequired(true)
        //                 .addChoices(
        //                     { name: 'Inventory Types', value: 'inventoryTypes' },
        //                     { name: 'Item Categories', value: 'itemCategories' },
        //                     { name: 'SubInventory Types', value: 'subInventoryTypes' }
        //                 ))),


    async autocomplete(interaction) {
        const focusedOption = interaction.options.getFocused(true);
        let choices = [];

        if (focusedOption.name === 'class_name') {
            const classSystem = interaction.options.getString('class_system');
            if (classSystem && inventoryAnalysisData && inventoryAnalysisData[classSystem]) {
                choices = Object.keys(inventoryAnalysisData[classSystem]).map(name => ({ name: name, value: name }));
            } else if (classSystem && PriceManager.config.defaultPrices[classSystem]) {
                // Fallback to keys already in price-config if analysis is not loaded
                choices = Object.keys(PriceManager.config.defaultPrices[classSystem]).map(name => ({ name: name, value: name }));
            }
            // Filter choices based on user input
            const filtered = choices.filter(choice => choice.name.toLowerCase().startsWith(focusedOption.value.toLowerCase())).slice(0, 10);
            await interaction.respond(filtered);
        }
    },

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return await interaction.reply({
                content: '❌ Você não tem permissão para usar este comando.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'view') {
                const currentPrices = PriceManager.getAllPriceConfigs();
                const embed = new EmbedBuilder()
                    .setTitle(`💰 Configuração de Preços Atual (${PriceManager.currency})`)
                    .setColor('#0099ff')
                    .setTimestamp();

                embed.addFields({ name: 'Moeda Padrão', value: currentPrices.currency, inline: true });
                embed.addFields({ name: 'Preço Fallback', value: String(currentPrices.fallbackPrice), inline: true });

                if (Object.keys(currentPrices.defaultPrices.inventoryTypes).length > 0) {
                    embed.addFields({ name: 'Tipos de Inventário (Padrão)', value: "```json\n" + JSON.stringify(currentPrices.defaultPrices.inventoryTypes, null, 2) + "\n```" });
                }
                if (Object.keys(currentPrices.defaultPrices.itemCategories).length > 0) {
                    embed.addFields({ name: 'Categorias de Item (Padrão)', value: "```json\n" + JSON.stringify(currentPrices.defaultPrices.itemCategories, null, 2) + "\n```" });
                }
                if (Object.keys(currentPrices.defaultPrices.subInventoryTypes).length > 0) {
                    embed.addFields({ name: 'Subtipos de Inventário (Padrão)', value: "```json\n" + JSON.stringify(currentPrices.defaultPrices.subInventoryTypes, null, 2) + "\n```" });
                }
                if (Object.keys(currentPrices.itemOverrides).length > 0) {
                    const overrideChunks = [];
                    const overrideJson = JSON.stringify(currentPrices.itemOverrides, null, 2);
                    for (let i = 0; i < overrideJson.length; i += 1000) { // Discord field value limit
                        overrideChunks.push(overrideJson.substring(i, Math.min(overrideJson.length, i + 1000)));
                    }
                    overrideChunks.forEach((chunk, index) => {
                         embed.addFields({ name: `Overrides de Item Específico ${overrideChunks.length > 1 ? `(Parte ${index + 1})` : ''}`, value: "```json\n" + chunk + "\n```" });
                    });
                } else {
                     embed.addFields({ name: 'Overrides de Item Específico', value: "Nenhum override definido."});
                }

                await interaction.reply({ embeds: [embed], ephemeral: true });

            } else if (subcommand === 'set-item') {
                const itemKey = interaction.options.getString('itemkey');
                const priceInput = interaction.options.getInteger('price');
                const price = (priceInput === 0) ? null : priceInput; // Treat 0 as removal

                if (price !== null && (isNaN(price) || price < 0)) {
                     return await interaction.reply({ content: '❌ Preço inválido. Deve ser um número não negativo.', ephemeral: true });
                }

                const success = PriceManager.setItemPrice(itemKey, price);
                if (success) {
                    await interaction.reply({ content: `✅ Preço para o item '${itemKey}' ${price === null ? 'removido' : `definido para ${price} ${PriceManager.currency}`}.`, ephemeral: true });
                } else {
                    await interaction.reply({ content: '❌ Falha ao definir o preço do item. Verifique os logs.', ephemeral: true });
                }


            } else if (subcommand === 'set-class') {
                const classSystem = interaction.options.getString('class_system');
                const className = interaction.options.getString('class_name');
                const priceInput = interaction.options.getInteger('price');
                const price = (priceInput === 0) ? null : priceInput; // Treat 0 as removal for consistency
                
                if (price !== null && (isNaN(price) || price < 0)) {
                     return await interaction.reply({ content: '❌ Preço inválido. Deve ser um número não negativo.', ephemeral: true });
                }

                const success = PriceManager.setClassPrice(classSystem, className, price);
                 if (success) {
                    await interaction.reply({ content: `✅ Preço para a classe '<span class="math-inline">\{classSystem\}\.</span>{className}' ${price === null ? 'removido' : `definido para ${price} ${PriceManager.currency}`}.`, ephemeral: true });
                } else {
                    await interaction.reply({ content: '❌ Falha ao definir o preço da classe. Verifique os logs.', ephemeral: true });
                }
            }
            // } else if (subcommand === 'list-classes') { // Optional subcommand
            //     const classSystem = interaction.options.getString('class_system');
            //     let names = [];
            //     if (inventoryAnalysisData && inventoryAnalysisData[classSystem]) {
            //         names = Object.keys(inventoryAnalysisData[classSystem]);
            //     } else if (PriceManager.config.defaultPrices[classSystem]) {
            //         names = Object.keys(PriceManager.config.defaultPrices[classSystem]);
            //     }

            //     if (names.length > 0) {
            //         const embed = new EmbedBuilder()
            //             .setTitle(`Nomes de Classe para ${classSystem}`)
            //             .setDescription("```\n" + names.join('\n') + "\n```")
            //             .setColor('#0099ff');
            //         await interaction.reply({ embeds: [embed], ephemeral: true });
            //     } else {
            //         await interaction.reply({ content: `Nenhuma classe encontrada para o sistema '${classSystem}' na análise ou configuração.`, ephemeral: true });
            //     }
            // }

        } catch (error) {
            console.error(`Error executing /price-manage ${subcommand}:`, error);
            await interaction.reply({ content: '❌ Ocorreu um erro ao processar o comando.', ephemeral: true });
        }
    }
};