const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const User = require('../models/User');
const Account = require('../models/Account');
const Friendship = require('../models/Friendship');
const CartService = require('../services/cartService');
const { validateRiotTag } = require('../utils/validators');
const PriceManagerHandler = require('./priceManagerHandler');
const FriendshipService = require('../services/friendshipService');

module.exports = {
    async handle(interaction) {
        try {
            // Handlers para gerenciamento de preços
            if (interaction.customId.startsWith('price_edit_modal_')) {
                await PriceManagerHandler.handlePriceEditModal(interaction);
                return;
            }
            if (interaction.customId.startsWith('item_price_modal_')) {
                await PriceManagerHandler.handleItemPriceModal(interaction);
                return;
            }
            if (interaction.customId === 'search_item_modal') {
                await PriceManagerHandler.handleSearchModal(interaction);
                return;
            }
            if (interaction.customId.startsWith('import_config_modal')) {
                await PriceManagerHandler.handleImportConfigModal(interaction);
                return;
            }

            // Handlers de pesquisa
            if (interaction.customId.startsWith('search_category_modal_')) {
                await handleSearchCategoryModal(interaction);
                return;
            }

            // Handlers do carrinho
            if (interaction.customId.startsWith('lol_nickname_modal_')) {
                await handleLolNicknameModal(interaction);
                return; // ESTE RETURN ESTAVA FALTANDO
            } else if (interaction.customId.startsWith('search_items_modal_')) {
                await handleSearchItemsModal(interaction);
                return; // ESTE RETURN ESTAVA FALTANDO
            }
        } catch (error) {
            console.error('Error in modal handler:', error);
            await interaction.followUp({
                content: '❌ Erro ao processar modal.',
                ephemeral: true
            });
        }
    }
};

async function handleSearchCategoryModal(interaction) {
    try {
        console.log(`[DEBUG] handleSearchCategoryModal called`);
        await interaction.deferUpdate();

        // Debug: vamos ver o customId completo
        console.log(`[DEBUG] Full customId: ${interaction.customId}`);
        
        const parts = interaction.customId.split('_');
        console.log(`[DEBUG] CustomId parts:`, parts);
        
        // customId: search_category_modal_CARTID_CATEGORY
        // parts: ['search', 'category', 'modal', 'cartId', 'category', ...]
        
        if (parts.length < 5) {
            console.error(`[ERROR] Invalid customId format: ${interaction.customId}`);
            return await interaction.followUp({
                content: '❌ Erro no formato da pesquisa.',
                ephemeral: true
            });
        }
        
        const cartId = parts[3];
        // CORREÇÃO: Juntar todas as partes restantes para formar a categoria
        const category = parts.slice(4).join('_');
        
        console.log(`[DEBUG] Parsed - cartId: ${cartId}, category: ${category}`);
        
        const searchQuery = interaction.fields.getTextInputValue('search_query');
        console.log(`[DEBUG] Search query: "${searchQuery}"`);

        if (!searchQuery || searchQuery.trim().length < 2) {
            return await interaction.followUp({
                content: '❌ A busca deve ter pelo menos 2 caracteres.',
                ephemeral: true
            });
        }

        console.log(`[DEBUG] About to call handleSearchInCategory`);
        await CartService.handleSearchInCategory(interaction.channel, cartId, category, searchQuery.trim());
        console.log(`[DEBUG] handleSearchInCategory completed`);
        
    } catch (error) {
        console.error('[ERROR] Error handling search category modal:', error);
        console.error('[ERROR] Stack trace:', error.stack);
        
        try {
            await interaction.followUp({
                content: '❌ Erro ao processar busca.',
                ephemeral: true
            });
        } catch (followUpError) {
            console.error('[ERROR] Error sending followUp:', followUpError);
        }
    }
}

async function handleLolNicknameModal(interaction) {
    try {
        const accountId = interaction.customId.split('_')[3];
        const lolNickname = interaction.fields.getTextInputValue('lol_nickname');

        // Validate riot tag format
        if (!validateRiotTag(lolNickname)) {
            return await interaction.reply({
                content: '❌ Formato inválido! Use o formato: NickName#TAG (ex: Player#BR1)',
                ephemeral: true
            });
        }

        const [nickname, tag] = lolNickname.split('#');

        // Processar através do FriendshipService
        await FriendshipService.requestFriendship(interaction, accountId, nickname, tag);

    } catch (error) {
        console.error('Error handling LOL nickname modal:', error);

        try {
            if (interaction.deferred) {
                await interaction.editReply({
                    content: '❌ Erro ao processar pedido de amizade.'
                });
            } else {
                await interaction.reply({
                    content: '❌ Erro ao processar pedido de amizade.',
                    ephemeral: true
                });
            }
        } catch (replyError) {
            console.error('Error sending error message:', replyError);
        }
    }
}

async function handleSearchItemsModal(interaction) {
    try {
        await interaction.deferUpdate();

        const cartId = interaction.customId.split('_')[3];
        const searchQuery = interaction.fields.getTextInputValue('search_query');

        // Validate search query
        if (!searchQuery || searchQuery.trim().length < 2) {
            return await interaction.followUp({
                content: '❌ A busca deve ter pelo menos 2 caracteres.',
                ephemeral: true
            });
        }

        // Handle search
        await CartService.handleSearchItems(interaction.channel, cartId, searchQuery.trim());

    } catch (error) {
        console.error('Error handling search items modal:', error);

        try {
            await interaction.editReply({
                content: '❌ Erro ao processar busca.',
                components: []
            });
        } catch (editError) {
            console.error('Error editing reply:', editError);
            await interaction.followUp({
                content: '❌ Erro ao processar busca.',
                ephemeral: true
            });
        }
    }
}

async function showUserAccounts(interaction, userId) {
    try {
        const friendships = await Friendship.findByUserId(userId);

        if (friendships.length === 0) {
            const embed = new EmbedBuilder()
                .setTitle('✅ Amizade Adicionada')
                .setDescription('Amizade adicionada com sucesso!\n\nEsta é sua primeira conta adicionada.')
                .setColor('#57f287')
                .setTimestamp();

            return await interaction.editReply({ embeds: [embed] });
        }

        const embed = new EmbedBuilder()
            .setTitle('✅ Amizade Adicionada')
            .setDescription('**Suas contas adicionadas:**\n\n')
            .setColor('#57f287')
            .setTimestamp();

        for (const friendship of friendships) {
            const account = await Account.findById(friendship.account_id);
            if (account) {
                const timeSince = getTimeSince(friendship.added_at);

                embed.addFields({
                    name: `🎮 ${account.nickname}`,
                    value: `**Seu Nick:** ${friendship.lol_nickname}#${friendship.lol_tag}\n` +
                        `**Adicionado:** ${timeSince} atrás`,
                    inline: true
                });
            }
        }

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Error showing user accounts:', error);
    }
}

function getTimeSince(dateString) {
    const now = new Date();
    const past = new Date(dateString);
    const diffInMinutes = Math.floor((now - past) / (1000 * 60));

    if (diffInMinutes < 60) {
        return `${diffInMinutes} minuto(s)`;
    } else if (diffInMinutes < 1440) {
        const hours = Math.floor(diffInMinutes / 60);
        return `${hours} hora(s)`;
    } else {
        const days = Math.floor(diffInMinutes / 1440);
        return `${days} dia(s)`;
    }
}