// commands/slash/price.js
const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
const config = require('../../config.json');
const PriceManager = require('../../PriceManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('price')
        .setDescription('Gerencia preços do sistema')
        .setDefaultMemberPermissions(0) // Admin only
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('Mostra a configuração de preços atual')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('item')
                .setDescription('Edita o preço de um item específico')
                .addStringOption(option =>
                    option.setName('id')
                        .setDescription('ID do item')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('price')
                        .setDescription('Novo preço em RP (0 para remover override)')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('class')
                .setDescription('Edita preço de uma classe')
                .addStringOption(option =>
                    option.setName('system')
                        .setDescription('Sistema de classificação')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Inventory Types', value: 'inventoryTypes' },
                            { name: 'Item Categories', value: 'itemCategories' },
                            { name: 'Subinventory Types', value: 'subInventoryTypes' }
                        )
                )
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Nome da classe')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('price')
                        .setDescription('Novo preço em RP (0 para remover)')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('multiplier')
                .setDescription('Configura multiplicador de preço')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Nome do multiplicador')
                        .setRequired(true)
                )
                .addNumberOption(option =>
                    option.setName('value')
                        .setDescription('Valor do multiplicador (ex: 1.5 para +50%)')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('apply')
                .setDescription('Aplica preços configurados ao catálogo')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('Reseta todos os preços para o padrão')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('import')
                .setDescription('Importa configuração de preços')
                .addAttachmentOption(option =>
                    option.setName('file')
                        .setDescription('Arquivo JSON com a configuração')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('export')
                .setDescription('Exporta configuração de preços')
        ),

    async execute(interaction) {
        // Check if user has admin role
        if (!interaction.member.roles.cache.has(config.adminRoleId)) {
            return await interaction.reply({
                content: '❌ Você não tem permissão para usar este comando.',
                ephemeral: true
            });
        }

        const subcommand = interaction.options.getSubcommand();
        
        try {
            switch (subcommand) {
                case 'view':
                    await handleView(interaction);
                    break;
                case 'item':
                    await handleItemPrice(interaction);
                    break;
                case 'class':
                    await handleClassPrice(interaction);
                    break;
                case 'multiplier':
                    await handleMultiplier(interaction);
                    break;
                case 'apply':
                    await handleApply(interaction);
                    break;
                case 'reset':
                    await handleReset(interaction);
                    break;
                case 'import':
                    await handleImport(interaction);
                    break;
                case 'export':
                    await handleExport(interaction);
                    break;
                default:
                    await interaction.reply({
                        content: '❌ Subcomando desconhecido.',
                        ephemeral: true
                    });
            }
        } catch (error) {
            console.error(`Error executing /price ${subcommand}:`, error);
            await interaction.reply({
                content: `❌ Ocorreu um erro ao executar o comando: ${error.message}`,
                ephemeral: true
            });
        }
    }
};

/**
 * Handle the view subcommand
 */
async function handleView(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const currentPrices = PriceManager.getAllPriceConfigs();
        
        const embed = new EmbedBuilder()
            .setTitle(`💰 Configuração de Preços (${PriceManager.currency})`)
            .setColor('#0099ff')
            .setTimestamp();

        embed.addFields({ name: 'Moeda', value: currentPrices.currency, inline: true });
        embed.addFields({ name: 'Preço Fallback', value: String(currentPrices.fallbackPrice), inline: true });

        // Add inventory types
        if (Object.keys(currentPrices.defaultPrices.inventoryTypes).length > 0) {
            const inventoryTypesText = formatObjectTable(currentPrices.defaultPrices.inventoryTypes);
            embed.addFields({ 
                name: 'Tipos de Inventário', 
                value: `\`\`\`\n${inventoryTypesText}\n\`\`\``,
                inline: false 
            });
        }
        
        // Add item categories
        if (Object.keys(currentPrices.defaultPrices.itemCategories).length > 0) {
            const itemCategoriesText = formatObjectTable(currentPrices.defaultPrices.itemCategories);
            embed.addFields({ 
                name: 'Categorias de Item', 
                value: `\`\`\`\n${itemCategoriesText}\n\`\`\``,
                inline: false 
            });
        }
        
        // Add subinventory types
        if (Object.keys(currentPrices.defaultPrices.subInventoryTypes).length > 0) {
            const subInventoryTypesText = formatObjectTable(currentPrices.defaultPrices.subInventoryTypes);
            embed.addFields({ 
                name: 'Subtipos de Inventário', 
                value: `\`\`\`\n${subInventoryTypesText}\n\`\`\``,
                inline: false 
            });
        }
        
        // Add multipliers
        if (Object.keys(currentPrices.priceMultipliers).length > 0) {
            const multipliersText = formatObjectTable(currentPrices.priceMultipliers);
            embed.addFields({ 
                name: 'Multiplicadores', 
                value: `\`\`\`\n${multipliersText}\n\`\`\``,
                inline: false 
            });
        }
        
        // Add item overrides (split if needed due to character limits)
        if (Object.keys(currentPrices.itemOverrides).length > 0) {
            const overridesCount = Object.keys(currentPrices.itemOverrides).length;
            
            embed.addFields({ 
                name: `Overrides de Item (${overridesCount})`, 
                value: `Há ${overridesCount} override(s) de preço para itens específicos.`,
                inline: false 
            });
            
            // If there are many overrides, just show the count to avoid huge embeds
            if (overridesCount <= 10) {
                const overridesText = formatObjectTable(currentPrices.itemOverrides);
                if (overridesText.length <= 1024) {
                    embed.addFields({ 
                        name: 'Lista de Overrides', 
                        value: `\`\`\`\n${overridesText}\n\`\`\``,
                        inline: false 
                    });
                }
            }
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error viewing price configuration:', error);
        await interaction.editReply({ content: '❌ Erro ao visualizar configuração de preços: ' + error.message });
    }
}

/**
 * Handle the item price subcommand
 */
async function handleItemPrice(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const itemKey = interaction.options.getString('id');
        const price = interaction.options.getInteger('price');
        
        // Use 'null' to remove the override if price is 0
        const actualPrice = price === 0 ? null : price;
        
        // Validate price
        if (actualPrice !== null && (actualPrice < 0 || actualPrice > 10000)) {
            return await interaction.editReply({ 
                content: '❌ Preço inválido. Deve estar entre 0 e 10000 RP.' 
            });
        }
        
        // Update the price
        const success = PriceManager.setItemPrice(itemKey, actualPrice);
        
        if (success) {
            const embed = new EmbedBuilder()
                .setTitle(actualPrice === null ? '✅ Override Removido' : '✅ Preço Atualizado')
                .setDescription(
                    actualPrice === null
                        ? `O override de preço para o item **${itemKey}** foi removido.`
                        : `O preço do item **${itemKey}** foi definido para **${actualPrice} ${PriceManager.currency}**.`
                )
                .setColor('#57f287')
                .setTimestamp();
                
            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.editReply({ content: '❌ Falha ao atualizar o preço do item.' });
        }
    } catch (error) {
        console.error('Error updating item price:', error);
        await interaction.editReply({ content: '❌ Erro ao atualizar preço do item: ' + error.message });
    }
}

/**
 * Handle the class price subcommand
 */
async function handleClassPrice(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const classSystem = interaction.options.getString('system');
        const className = interaction.options.getString('name');
        const price = interaction.options.getInteger('price');
        
        // Use 'null' to remove the class price if 0
        const actualPrice = price === 0 ? null : price;
        
        // Validate price
        if (actualPrice !== null && (actualPrice < 0 || actualPrice > 10000)) {
            return await interaction.editReply({ 
                content: '❌ Preço inválido. Deve estar entre 0 e 10000 RP.' 
            });
        }
        
        // Validate class system
        if (!PriceManager.getValidClassSystems().includes(classSystem)) {
            return await interaction.editReply({ 
                content: '❌ Sistema de classe inválido.' 
            });
        }
        
        // Update the class price
        const success = PriceManager.setClassPrice(classSystem, className, actualPrice);
        
        if (success) {
            const embed = new EmbedBuilder()
                .setTitle(actualPrice === null ? '✅ Preço de Classe Removido' : '✅ Preço de Classe Atualizado')
                .setDescription(
                    actualPrice === null
                        ? `O preço padrão para a classe **${className}** (${classSystem}) foi removido.`
                        : `O preço da classe **${className}** (${classSystem}) foi definido para **${actualPrice} ${PriceManager.currency}**.`
                )
                .setColor('#57f287')
                .setTimestamp();
                
            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.editReply({ content: '❌ Falha ao atualizar o preço da classe.' });
        }
    } catch (error) {
        console.error('Error updating class price:', error);
        await interaction.editReply({ content: '❌ Erro ao atualizar preço da classe: ' + error.message });
    }
}

/**
 * Handle the multiplier subcommand
 */
async function handleMultiplier(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const multiplierName = interaction.options.getString('name');
        const multiplierValue = interaction.options.getNumber('value');
        
        // Validate multiplier
        if (multiplierValue < 0 || multiplierValue > 10) {
            return await interaction.editReply({ 
                content: '❌ Valor de multiplicador inválido. Deve estar entre 0 e 10.' 
            });
        }
        
        // Use 'null' to remove the multiplier if 0
        const actualValue = multiplierValue === 0 ? null : multiplierValue;
        
        // Update the multiplier
        const success = PriceManager.setMultiplier(multiplierName, actualValue);
        
        if (success) {
            const embed = new EmbedBuilder()
                .setTitle(actualValue === null ? '✅ Multiplicador Removido' : '✅ Multiplicador Atualizado')
                .setDescription(
                    actualValue === null
                        ? `O multiplicador **${multiplierName}** foi removido.`
                        : `O multiplicador **${multiplierName}** foi definido para **${actualValue}** (${(actualValue * 100 - 100).toFixed(0)}% ${actualValue > 1 ? 'adicional' : 'redução'}).`
                )
                .setColor('#57f287')
                .setTimestamp();
                
            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.editReply({ content: '❌ Falha ao atualizar o multiplicador.' });
        }
    } catch (error) {
        console.error('Error updating multiplier:', error);
        await interaction.editReply({ content: '❌ Erro ao atualizar multiplicador: ' + error.message });
    }
}

/**
 * Handle the apply subcommand
 */
async function handleApply(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
        // Check if catalog exists
        if (!fs.existsSync('./catalog.json')) {
            return await interaction.editReply({ content: '❌ Catálogo não encontrado.' });
        }
        
        // Apply prices to catalog
        await interaction.editReply({ content: '⏳ Aplicando preços ao catálogo...' });
        
        const result = await PriceManager.applyCatalogPrices('./catalog.json');
        
        if (result) {
            // Reload catalog to get statistics
            const catalog = JSON.parse(fs.readFileSync('./catalog.json', 'utf8'));
            
            // Calculate price statistics
            const totalItems = catalog.length;
            const priceRanges = {
                'Gratuito (0 RP)': 0,
                '1-520 RP': 0,
                '521-975 RP': 0,
                '976-1350 RP': 0,
                '1351-1820 RP': 0,
                '1821-3250 RP': 0,
                'Acima de 3250 RP': 0
            };
            
            let totalRP = 0;
            
            catalog.forEach(item => {
                const price = item.price || 0;
                totalRP += price;
                
                if (price === 0) priceRanges['Gratuito (0 RP)']++;
                else if (price <= 520) priceRanges['1-520 RP']++;
                else if (price <= 975) priceRanges['521-975 RP']++;
                else if (price <= 1350) priceRanges['976-1350 RP']++;
                else if (price <= 1820) priceRanges['1351-1820 RP']++;
                else if (price <= 3250) priceRanges['1821-3250 RP']++;
                else priceRanges['Acima de 3250 RP']++;
            });
            
            const avgPrice = totalItems > 0 ? Math.round(totalRP / totalItems) : 0;
            
            // Create report
            const embed = new EmbedBuilder()
                .setTitle('✅ Preços Aplicados ao Catálogo')
                .setDescription(`Os preços foram aplicados com sucesso ao catálogo.`)
                .addFields([
                    { name: '📊 Total de Itens', value: totalItems.toString(), inline: true },
                    { name: '💰 Preço Médio', value: `${avgPrice.toLocaleString()} RP`, inline: true },
                    { name: '📈 Distribuição de Preços', value: formatObjectTable(priceRanges), inline: false },
                    { name: '⚙️ Configuração', value: 'Use `/price view` para ver a configuração atual de preços.' }
                ])
                .setColor('#57f287')
                .setTimestamp();
                
            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.editReply({ content: '❌ Falha ao aplicar preços ao catálogo.' });
        }
    } catch (error) {
        console.error('Error applying prices to catalog:', error);
        await interaction.editReply({ content: '❌ Erro ao aplicar preços ao catálogo: ' + error.message });
    }
}

/**
 * Handle the reset subcommand
 */
async function handleReset(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
        // Show confirmation message
        const confirmEmbed = new EmbedBuilder()
            .setTitle('⚠️ Confirmação')
            .setDescription(
                '**Tem certeza que deseja resetar todos os preços para os valores padrão?**\n\n' +
                'Esta ação irá:\n' +
                '- Remover todos os overrides de item\n' +
                '- Resetar todos os preços de classe\n' +
                '- Resetar todos os multiplicadores\n\n' +
                '**Nota:** Esta ação não pode ser desfeita!\n\n' +
                'Confirme sua ação respondendo com `confirmar` nos próximos 30 segundos.'
            )
            .setColor('#faa61a')
            .setTimestamp();
            
        const message = await interaction.editReply({ embeds: [confirmEmbed] });
        
        // Create message collector
        const filter = m => m.author.id === interaction.user.id;
        const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });
        
        collector.on('collect', async (m) => {
            if (m.content.toLowerCase() === 'confirmar') {
                // Try to delete the confirmation message to keep channel clean
                try {
                    await m.delete();
                } catch (error) {
                    // Ignore delete errors
                }
                
                // Reset price config
                const defaultConfig = PriceManager.getDefaultConfig();
                fs.writeFileSync('./price-config.json', JSON.stringify(defaultConfig, null, 2));
                
                // Reload config
                PriceManager.loadConfig();
                
                // Success message
                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ Preços Resetados')
                    .setDescription('Todos os preços foram resetados para os valores padrão.')
                    .setColor('#57f287')
                    .setTimestamp();
                    
                await interaction.editReply({ embeds: [successEmbed] });
            } else {
                // Cancel message
                const cancelEmbed = new EmbedBuilder()
                    .setTitle('❌ Reset Cancelado')
                    .setDescription('A operação foi cancelada pelo usuário.')
                    .setColor('#ed4245')
                    .setTimestamp();
                    
                await interaction.editReply({ embeds: [cancelEmbed] });
            }
        });
        
        collector.on('end', async (collected) => {
            if (collected.size === 0) {
                // Timeout message
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏱️ Tempo Esgotado')
                    .setDescription('A operação foi cancelada por falta de resposta.')
                    .setColor('#ed4245')
                    .setTimestamp();
                    
                await interaction.editReply({ embeds: [timeoutEmbed] });
            }
        });
    } catch (error) {
        console.error('Error resetting prices:', error);
        await interaction.editReply({ content: '❌ Erro ao resetar preços: ' + error.message });
    }
}

/**
 * Handle the import subcommand
 */
async function handleImport(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const attachment = interaction.options.getAttachment('file');
        
        if (!attachment) {
            return await interaction.editReply({ content: '❌ Nenhum arquivo fornecido.' });
        }
        
        if (!attachment.name.endsWith('.json')) {
            return await interaction.editReply({ content: '❌ Arquivo deve ser do tipo JSON.' });
        }
        
        // Download the attachment
        const response = await fetch(attachment.url);
        const fileContent = await response.text();
        
        // Validate JSON
        let priceConfig;
        try {
            priceConfig = JSON.parse(fileContent);
        } catch (error) {
            return await interaction.editReply({ content: '❌ Arquivo JSON inválido: ' + error.message });
        }
        
        // Validate config structure
        if (!priceConfig.defaultPrices || !priceConfig.priceMultipliers) {
            return await interaction.editReply({ content: '❌ Estrutura da configuração de preços inválida.' });
        }
        
        // Create backup of current config
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = `./price-config_backup_${timestamp}.json`;
        
        if (fs.existsSync('./price-config.json')) {
            fs.copyFileSync('./price-config.json', backupPath);
        }
        
        // Save new config
        fs.writeFileSync('./price-config.json', JSON.stringify(priceConfig, null, 2));
        
        // Reload config
        PriceManager.loadConfig();
        
        // Success message
        const embed = new EmbedBuilder()
            .setTitle('✅ Configuração de Preços Importada')
            .setDescription('A configuração de preços foi importada com sucesso.')
            .addFields([
                { name: '📁 Backup', value: backupPath, inline: false },
                { name: '⚙️ Classes', value: `${Object.keys(priceConfig.defaultPrices.itemCategories).length} categorias, ${Object.keys(priceConfig.defaultPrices.inventoryTypes).length} tipos de inventário`, inline: false },
                { name: '💹 Multiplicadores', value: `${Object.keys(priceConfig.priceMultipliers).length} multiplicadores`, inline: false },
                { name: '🔄 Próximos Passos', value: 'Use `/price apply` para aplicar os novos preços ao catálogo.', inline: false }
            ])
            .setColor('#57f287')
            .setTimestamp();
            
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error importing price config:', error);
        await interaction.editReply({ content: '❌ Erro ao importar configuração de preços: ' + error.message });
    }
}

/**
 * Handle the export subcommand
 */
async function handleExport(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    try {
        const configPath = './price-config.json';
        if (!fs.existsSync(configPath)) {
            return await interaction.editReply({ content: '❌ Configuração de preços não encontrada.' });
        }
        
        // Read the file
        const configData = fs.readFileSync(configPath);
        
        // Create an attachment
        const attachment = new AttachmentBuilder(configData, { name: 'price_config_export.json' });
        
        const embed = new EmbedBuilder()
            .setTitle('📤 Configuração de Preços Exportada')
            .setDescription(`A configuração de preços foi exportada com sucesso.`)
            .addFields([
                { name: '📂 Arquivo', value: 'price_config_export.json', inline: true },
                { name: '⏰ Data e Hora', value: new Date().toLocaleString(), inline: true }
            ])
            .setColor('#5865f2')
            .setTimestamp();
            
        await interaction.editReply({ 
            embeds: [embed],
            files: [attachment]
        });
    } catch (error) {
        console.error('Error exporting price config:', error);
        await interaction.editReply({ content: '❌ Erro ao exportar configuração de preços: ' + error.message });
    }
}

/**
 * Format an object as a table-like string for display in code blocks
 */
function formatObjectTable(obj) {
    const entries = Object.entries(obj).sort((a, b) => {
        // First try to sort by value (descending)
        if (b[1] !== a[1]) return b[1] - a[1];
        // Then sort by key (alphabetical)
        return a[0].localeCompare(b[0]);
    });
    
    if (entries.length === 0) return 'Nenhum item';
    
    // Find the longest key for padding
    const longestKey = Math.max(...entries.map(([key]) => key.length));
    
    // Format as a table
    return entries.map(([key, value]) => {
        const paddedKey = key.padEnd(longestKey);
        return `${paddedKey} : ${value}`;
    }).join('\n');
}