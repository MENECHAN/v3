const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs');

class PriceManagerHandler {
    static async handlePriceButton(interaction) {
        try {
            const category = interaction.customId.replace('edit_price_', '');
            await this.showPriceEditModal(interaction, category);
        } catch (error) {
            console.error('Error handling price button:', error);
            await interaction.reply({
                content: '❌ Erro ao processar botão de preço.',
                ephemeral: true
            });
        }
    }

    static async handleSearchButton(interaction) {
        try {
            const modal = new ModalBuilder()
                .setCustomId('search_item_modal')
                .setTitle('Buscar Item');

            const searchInput = new TextInputBuilder()
                .setCustomId('search_term')
                .setLabel('Nome do campeão ou skin')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ex: Yasuo, PROJECT, Elementalist...')
                .setRequired(true)
                .setMaxLength(100);

            const firstActionRow = new ActionRowBuilder().addComponents(searchInput);
            modal.addComponents(firstActionRow);

            await interaction.showModal(modal);
        } catch (error) {
            console.error('Error handling search button:', error);
            await interaction.reply({
                content: '❌ Erro ao processar busca.',
                ephemeral: true
            });
        }
    }

    static async handleResetConfirmation(interaction) {
        try {
            const action = interaction.customId.split('_')[0]; // confirm ou cancel

            if (action === 'confirm') {
                // Reset prices to default
                const defaultConfig = this.getDefaultPriceConfig();
                fs.writeFileSync('./price-config.json', JSON.stringify(defaultConfig, null, 2));

                const embed = new EmbedBuilder()
                    .setTitle('✅ Preços Resetados')
                    .setDescription('Todos os preços foram resetados para os valores padrão.')
                    .setColor('#57f287')
                    .setTimestamp();

                await interaction.update({
                    embeds: [embed],
                    components: []
                });
            } else {
                // Cancel reset
                const embed = new EmbedBuilder()
                    .setTitle('❌ Reset Cancelado')
                    .setDescription('O reset dos preços foi cancelado.')
                    .setColor('#ed4245')
                    .setTimestamp();

                await interaction.update({
                    embeds: [embed],
                    components: []
                });
            }
        } catch (error) {
            console.error('Error handling reset confirmation:', error);
            await interaction.followUp({
                content: '❌ Erro ao processar confirmação.',
                ephemeral: true
            });
        }
    }

    static async handleItemPriceEdit(interaction) {
        try {
            const modal = new ModalBuilder()
                .setCustomId('item_price_modal')
                .setTitle('Editar Preço do Item');

            const priceInput = new TextInputBuilder()
                .setCustomId('new_price')
                .setLabel('Novo preço em RP')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ex: 1350')
                .setRequired(true);

            const firstActionRow = new ActionRowBuilder().addComponents(priceInput);
            modal.addComponents(firstActionRow);

            await interaction.showModal(modal);
        } catch (error) {
            console.error('Error handling item price edit:', error);
            await interaction.reply({
                content: '❌ Erro ao editar preço do item.',
                ephemeral: true
            });
        }
    }

    static async showPriceEditModal(interaction, category) {
        try {
            const modal = new ModalBuilder()
                .setCustomId(`price_edit_modal_${category}`)
                .setTitle(`Editar Preço - ${category}`);

            const priceInput = new TextInputBuilder()
                .setCustomId('new_price')
                .setLabel('Novo Preço (RP) ou Multiplicador')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ex: 1820 ou 0.85')
                .setRequired(true);

            const firstActionRow = new ActionRowBuilder().addComponents(priceInput);
            modal.addComponents(firstActionRow);

            await interaction.showModal(modal);
        } catch (error) {
            console.error('Error showing price edit modal:', error);
            await interaction.reply({
                content: '❌ Erro ao mostrar modal de edição.',
                ephemeral: true
            });
        }
    }

    static async handlePriceEditModal(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const category = interaction.customId.replace('price_edit_modal_', '');
            const newPrice = interaction.fields.getTextInputValue('new_price');

            // Validar entrada
            const numericValue = parseFloat(newPrice);
            if (isNaN(numericValue) || numericValue <= 0) {
                return await interaction.editReply({
                    content: '❌ Preço inválido. Use apenas números positivos.'
                });
            }

            // Carregar configuração atual
            let priceConfig = this.getDefaultPriceConfig();
            if (fs.existsSync('./price-config.json')) {
                priceConfig = JSON.parse(fs.readFileSync('./price-config.json', 'utf8'));
            }

            // Atualizar preço baseado na categoria
            if (['ultimate', 'legendary', 'epic', 'rare', 'common', 'chroma'].includes(category.toLowerCase())) {
                const rarityName = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
                priceConfig.categories.CHAMPION_SKIN[rarityName] = Math.round(numericValue);
            } else if (category === 'bundles') {
                priceConfig.categories.BUNDLES.multiplier = numericValue;
            } else if (category === 'hextech') {
                priceConfig.categories.HEXTECH.multiplier = numericValue;
            } else if (category === 'prestige') {
                priceConfig.categories.PRESTIGE.price = Math.round(numericValue);
            }

            // Salvar configuração
            fs.writeFileSync('./price-config.json', JSON.stringify(priceConfig, null, 2));

            const embed = new EmbedBuilder()
                .setTitle('✅ Preço Atualizado')
                .setDescription(`Preço para **${category}** foi atualizado para **${numericValue}**`)
                .setColor('#57f287')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error handling price edit modal:', error);
            await interaction.editReply({
                content: '❌ Erro ao atualizar preço.'
            });
        }
    }

    static async handleItemPriceModal(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const newPrice = interaction.fields.getTextInputValue('new_price');
            const itemId = interaction.customId.split('_')[3]; // Assumindo customId como 'item_price_modal_ITEMID'

            // Validar entrada
            const numericValue = parseInt(newPrice);
            if (isNaN(numericValue) || numericValue <= 0) {
                return await interaction.editReply({
                    content: '❌ Preço inválido. Use apenas números inteiros positivos.'
                });
            }

            // Carregar catálogo
            if (!fs.existsSync('./catalog.json')) {
                return await interaction.editReply({
                    content: '❌ Catálogo não encontrado.'
                });
            }

            const catalog = JSON.parse(fs.readFileSync('./catalog.json', 'utf8'));
            const itemIndex = catalog.findIndex(item => item.id == itemId);

            if (itemIndex === -1) {
                return await interaction.editReply({
                    content: '❌ Item não encontrado no catálogo.'
                });
            }

            // Atualizar preço
            const oldPrice = catalog[itemIndex].price;
            catalog[itemIndex].price = numericValue;

            // Salvar catálogo
            fs.writeFileSync('./catalog.json', JSON.stringify(catalog, null, 2));

            const embed = new EmbedBuilder()
                .setTitle('✅ Preço do Item Atualizado')
                .setDescription(`**${catalog[itemIndex].name}**\n` +
                              `Preço anterior: ${oldPrice} RP\n` +
                              `Novo preço: ${numericValue} RP`)
                .setColor('#57f287')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error handling item price modal:', error);
            await interaction.editReply({
                content: '❌ Erro ao atualizar preço do item.'
            });
        }
    }

    static async handleSearchModal(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const searchTerm = interaction.fields.getTextInputValue('search_term').toLowerCase();

            // Carregar catálogo
            if (!fs.existsSync('./catalog.json')) {
                return await interaction.editReply({
                    content: '❌ Catálogo não encontrado.'
                });
            }

            const catalog = JSON.parse(fs.readFileSync('./catalog.json', 'utf8'));
            
            // Buscar itens
            const filteredItems = catalog.filter(item => 
                item.name.toLowerCase().includes(searchTerm) ||
                item.champion.toLowerCase().includes(searchTerm)
            );

            if (filteredItems.length === 0) {
                return await interaction.editReply({
                    content: `❌ Nenhum item encontrado para: **${searchTerm}**`
                });
            }

            // Limitar a 25 itens (limite do Discord)
            const itemsToShow = filteredItems.slice(0, 10);

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('item_price_select')
                .setPlaceholder('Selecione um item para editar o preço')
                .addOptions(
                    itemsToShow.map(item => ({
                        label: item.name.substring(0, 100),
                        description: `${item.champion} - ${item.price} RP`.substring(0, 100),
                        value: item.id.toString()
                    }))
                );

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const embed = new EmbedBuilder()
                .setTitle('🔍 Resultados da Busca')
                .setDescription(`Encontrados **${filteredItems.length}** itens para: **${searchTerm}**\n\n` +
                              'Selecione um item para editar o preço:')
                .setColor('#5865f2')
                .setTimestamp();

            await interaction.editReply({
                embeds: [embed],
                components: [row]
            });
        } catch (error) {
            console.error('Error handling search modal:', error);
            await interaction.editReply({
                content: '❌ Erro ao buscar itens.'
            });
        }
    }

    static async handleImportConfigModal(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const configJson = interaction.fields.getTextInputValue('config_json');

            let newConfig;
            try {
                newConfig = JSON.parse(configJson);
            } catch (parseError) {
                return await interaction.editReply({
                    content: '❌ JSON inválido. Verifique a formatação.'
                });
            }

            // Validar estrutura básica
            if (!newConfig.categories || !newConfig.modifiers) {
                return await interaction.editReply({
                    content: '❌ Estrutura de configuração inválida.'
                });
            }

            // Fazer backup da configuração atual
            if (fs.existsSync('./price-config.json')) {
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const backupPath = `./price-config-backup-${timestamp}.json`;
                fs.copyFileSync('./price-config.json', backupPath);
            }

            // Salvar nova configuração
            fs.writeFileSync('./price-config.json', JSON.stringify(newConfig, null, 2));

            const embed = new EmbedBuilder()
                .setTitle('✅ Configuração Importada')
                .setDescription('Nova configuração de preços foi importada com sucesso!')
                .setColor('#57f287')
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Error importing config:', error);
            await interaction.editReply({
                content: '❌ Erro ao importar configuração.'
            });
        }
    }

    static getDefaultPriceConfig() {
        return {
            categories: {
                CHAMPION_SKIN: {
                    Ultimate: 3250,
                    Legendary: 1820,
                    Epic: 1350,
                    Rare: 975,
                    Common: 520,
                    Chroma: 290,
                    Prestige: 2000,
                    Mythic: 10,
                    Hextech: 2200
                },
                CHAMPION: {
                    price: 790
                },
                BUNDLES: {
                    multiplier: 0.85
                },
                HEXTECH: {
                    multiplier: 1.2
                },
                PRESTIGE: {
                    price: 2000
                },
                MYTHIC: {
                    price: 10
                }
            },
            modifiers: {
                prestige: 1.5,
                mythic: 2.0,
                limited: 1.3,
                legacy: 1.1,
                chroma: 0.5
            }
        };
    }
}

module.exports = PriceManagerHandler;