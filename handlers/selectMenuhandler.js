// handlers/selectMenuHandler.js - Corrigir todos os ephemeral para flags

const { EmbedBuilder, StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const CartService = require('../services/cartService');
const Cart = require('../models/Cart');
const config = require('../config.json'); 

module.exports = {
    async handle(interaction) {
        try {
            console.log(`[DEBUG SelectMenu] Received interaction: ${interaction.customId}`);
            if (interaction.customId.startsWith('select_checkout_account_')) {
                await handleCheckoutAccountSelection(interaction);
            } else if (interaction.customId.startsWith('category_select_')) {
                await handleCategorySelection(interaction);
            } else if (interaction.customId.startsWith('category_select_')) {
                await handleCategorySelection(interaction);
            } else if (interaction.customId.startsWith('item_select_')) {
                await handleItemSelection(interaction);
            } else if (interaction.customId.startsWith('search_result_select_')) {
                await handleSearchResultSelection(interaction);
            } else if (interaction.customId.startsWith('remove_item_select_')) {
                await handleItemRemoval(interaction);
            } else if (interaction.customId.startsWith('select_account_')) {
                console.log(`[DEBUG SelectMenu] Calling handleAccountSelection`);
                await handleAccountSelection(interaction);
            } else {
                console.log(`[DEBUG SelectMenu] Unknown select menu: ${interaction.customId}`);
            }
        } catch (error) {
            console.error('[ERROR SelectMenu] Error in main handler:', error);

            try {
                await interaction.followUp({
                    content: '❌ Erro ao processar seleção.',
                    ephemeral: true
                });
            } catch (followUpError) {
                console.error('[ERROR SelectMenu] FollowUp error:', followUpError);
            }
        }
    }
};

async function handleItemSelection(interaction) {
    try {
        await interaction.deferUpdate();

        const [, , cartId, category, page] = interaction.customId.split('_');
        const selectedItemId = interaction.values[0];

        // Show item preview
        await CartService.sendItemPreviewEmbed(interaction.channel, cartId, selectedItemId);
    } catch (error) {
        console.error('Error handling item selection:', error);
        await interaction.followUp({
            content: '❌ Erro ao carregar item.',
            ephemeral: true
        });
    }
}

async function handleSearchResultSelection(interaction) {
    try {
        await interaction.deferUpdate();

        const cartId = interaction.customId.split('_')[3];
        const selectedItemId = interaction.values[0];

        // Show item preview
        await CartService.sendItemPreviewEmbed(interaction.channel, cartId, selectedItemId);
    } catch (error) {
        console.error('Error handling search result selection:', error);
        await interaction.followUp({
            content: '❌ Erro ao carregar item.',
            ephemeral: true
        });
    }
}

async function handleCategorySelection(interaction) {
    try {
        console.log(`[DEBUG] handleCategorySelection started`);
        await interaction.deferUpdate();

        const cartId = interaction.customId.split('_')[2];
        const selectedCategory = interaction.values[0];

        console.log(`[DEBUG] handleCategorySelection - cartId: ${cartId}, selectedCategory: ${selectedCategory}`);

        // Show items from selected category
        console.log(`[DEBUG] About to call sendItemsEmbed`);
        await CartService.sendItemsEmbed(interaction.channel, cartId, selectedCategory, 1);
        console.log(`[DEBUG] sendItemsEmbed completed successfully`);

    } catch (error) {
        console.error('[ERROR] Error handling category selection:', error);
        console.error('[ERROR] Stack trace:', error.stack);
        await interaction.followUp({
            content: '❌ Erro ao carregar categoria.',
            ephemeral: true
        });
    }
}

async function handleCheckoutAccountSelection(interaction) {
    try {
        await interaction.deferUpdate();

        const cartId = interaction.customId.split('_')[3];
        const selectedAccountId = interaction.values[0];

        console.log(`[DEBUG] Account selected for checkout: Cart ${cartId}, Account ${selectedAccountId}`);

        // Buscar informações necessárias
        const Cart = require('../models/Cart');
        const Account = require('../models/Account');
        const User = require('../models/User');
        const Friendship = require('../models/Friendship');

        const cart = await Cart.findById(cartId);
        const selectedAccount = await Account.findById(selectedAccountId);
        const user = await User.findOrCreate(interaction.user.id, interaction.user.username);
        const friendship = await Friendship.findByUserAndAccount(user.id, selectedAccountId);

        if (!cart || !selectedAccount || !friendship) {
            return await interaction.followUp({
                content: '❌ Erro ao encontrar informações necessárias.',
                ephemeral: true
            });
        }

        // Verificar se ainda é elegível
        const FriendshipService = require('../services/friendshipService');
        const eligibility = await FriendshipService.canSendGifts(user.id, selectedAccountId);

        if (!eligibility.canSend) {
            return await interaction.followUp({
                content: `❌ Esta conta não é mais elegível para presentes.\n${eligibility.reason}`,
                ephemeral: true
            });
        }

        // Buscar itens e calcular totais
        const items = await Cart.getItems(cartId);
        const totalRP = items.reduce((sum, item) => sum + item.skin_price, 0);
        const totalPriceEUR = totalRP * 0.01;

        // Preparar métodos de pagamento do config
        const config = require('../config.json');
        let paymentMethods = '';

        if (config.paymentMethods?.paypal) {
            paymentMethods += `**💳 PayPal:**\n${config.paymentMethods.paypal.instructions}\n\n`;
        }

        if (config.paymentMethods?.crypto) {
            paymentMethods += `**🔗 Crypto:**\n${config.paymentMethods.crypto.instructions}\n\n`;
        }

        if (config.paymentMethods?.bank) {
            paymentMethods += `**🏦 Bank Transfer:**\n${config.paymentMethods.bank.instructions}\n\n`;
        }

        if (!paymentMethods) {
            paymentMethods = 'Métodos de pagamento não configurados.';
        }

        // Criar lista de itens
        const itemsList = items.map((item, index) =>
            `${index + 1}. ${item.skin_name} - ${item.skin_price.toLocaleString()} RP`
        ).join('\n');

        const embed = new EmbedBuilder()
            .setTitle('💳 Confirmar Pedido')
            .setDescription(
                `**🎮 Conta selecionada:** ${selectedAccount.nickname}\n` +
                `**👤 Seu nick:** ${friendship.lol_nickname}#${friendship.lol_tag}\n` +
                `**💎 Total:** ${totalRP.toLocaleString()} RP (€${totalPriceEUR.toFixed(2)})\n\n` +
                `Revise as informações antes de confirmar:`
            )
            .addFields([
                {
                    name: '📦 Itens do Pedido',
                    value: itemsList.length > 1024 ? itemsList.substring(0, 1021) + '...' : itemsList,
                    inline: false
                },
                {
                    name: '💳 Métodos de Pagamento',
                    value: paymentMethods.length > 1024 ? paymentMethods.substring(0, 1021) + '...' : paymentMethods,
                    inline: false
                },
                {
                    name: '📝 Próximos Passos',
                    value:
                        '1. ✅ Clique em "Confirmar Pedido"\n' +
                        '2. 💳 Realize o pagamento\n' +
                        '3. 📷 Envie o comprovante neste canal\n' +
                        '4. ⏳ Aguarde aprovação\n' +
                        '5. 🎁 Receba os presentes na conta selecionada',
                    inline: false
                }
            ])
            .setColor('#00ff00')
            .setFooter({ text: `Carrinho ID: ${cartId} | Conta: ${selectedAccount.nickname}` })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_checkout_account_${cartId}_${selectedAccountId}`)
                    .setLabel('✅ Confirmar Pedido')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`checkout_${cartId}`)
                    .setLabel('🔄 Trocar Conta')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`back_cart_${cartId}`)
                    .setLabel('◀️ Voltar ao Carrinho')
                    .setStyle(ButtonStyle.Danger)
            );

        await interaction.editReply({
            embeds: [embed],
            components: [row]
        });

    } catch (error) {
        console.error('Error handling checkout account selection:', error);
        await interaction.followUp({
            content: '❌ Erro ao processar seleção de conta.',
            ephemeral: true
        });
    }
}

async function handleItemRemoval(interaction) {
    try {
        await interaction.deferUpdate();

        const cartId = interaction.customId.split('_')[3];
        const itemId = interaction.values[0];

        // Remove item from cart
        await Cart.removeItem(itemId);

        // Update cart totals
        await Cart.updateTotals(cartId);

        // Return to cart view
        const cart = await Cart.findById(cartId);
        await CartService.sendCartEmbed(interaction.channel, cart);

        await interaction.followUp({
            content: '✅ Item removido do carrinho!',
            ephemeral: true
        });
    } catch (error) {
        console.error('Error removing item:', error);
        await interaction.followUp({
            content: '❌ Erro ao remover item.',
            ephemeral: true
        });
    }
}

async function handleCheckoutAccountSelection(interaction) {
    try {
        console.log(`[DEBUG SelectMenu] Checkout account selection started`);
        await interaction.deferUpdate();

        const cartId = interaction.customId.split('_')[3];
        const selectedAccountId = interaction.values[0];

        console.log(`[DEBUG SelectMenu] Checkout account selection: Cart ${cartId}, Account ${selectedAccountId}`);

        // Buscar carrinho
        const cart = await Cart.findById(cartId);
        if (!cart) {
            return await interaction.followUp({
                content: '❌ Carrinho não encontrado.',
                ephemeral: true
            });
        }

        // Buscar conta selecionada
        const Account = require('../models/Account');
        const selectedAccount = await Account.findById(selectedAccountId);

        if (!selectedAccount) {
            return await interaction.followUp({
                content: '❌ Conta selecionada não encontrada.',
                ephemeral: true
            });
        }

        // Calcular totais
        const items = await Cart.getItems(cartId);
        const totalRP = items.reduce((sum, item) => sum + item.skin_price, 0);
        const totalPrice = totalRP * 0.01;

        // ⭐ VERIFICAR SE A CONTA TEM RP SUFICIENTE
        if (selectedAccount.rp_amount < totalRP) {
            const insufficientEmbed = new EmbedBuilder()
                .setTitle('❌ RP Insuficiente')
                .setDescription(
                    `A conta selecionada não possui RP suficiente para este pedido.\n\n` +
                    `**Conta:** ${selectedAccount.nickname}\n` +
                    `**RP disponível:** ${selectedAccount.rp_amount.toLocaleString()}\n` +
                    `**RP necessário:** ${totalRP.toLocaleString()}\n` +
                    `**Faltam:** ${(totalRP - selectedAccount.rp_amount).toLocaleString()} RP\n\n` +
                    `💡 Adicione mais RP nesta conta ou escolha outra.`
                )
                .setColor('#ed4245')
                .setTimestamp();

            return await interaction.editReply({
                embeds: [insufficientEmbed],
                components: []
            });
        }

        // ⭐ CONFIRMAR A SELEÇÃO DA CONTA
        await Cart.updateStatus(cartId, 'pending_payment');

        // Buscar informações da amizade para mostrar detalhes
        const User = require('../models/User');
        const Friendship = require('../models/Friendship');

        const user = await User.findByDiscordId(interaction.user.id);
        const friendship = await Friendship.findByUserAndAccount(user.id, selectedAccountId);

        // Preparar métodos de pagamento
        const paymentMethods = Object.entries(config.paymentMethods || {})
            .map(([method, details]) =>
                `**${method.toUpperCase()}:**\n${details.instructions}`
            ).join('\n\n') || 'Métodos de pagamento não configurados';

        // ⭐ EMBED DE CONFIRMAÇÃO
        const confirmationEmbed = new EmbedBuilder()
            .setTitle('✅ Conta Selecionada - Proceder com Pagamento')
            .setDescription(
                `**Sua conta de destino foi selecionada com sucesso!**\n\n` +
                `🎮 **Conta de destino:** ${selectedAccount.nickname}\n` +
                `🏷️ **Seu nick:** ${friendship?.lol_nickname}#${friendship?.lol_tag}\n` +
                `💎 **RP disponível:** ${selectedAccount.rp_amount.toLocaleString()}\n\n` +
                `**📦 Total do pedido:** ${totalRP.toLocaleString()} RP (€${totalPrice.toFixed(2)})`
            )
            .addFields([
                {
                    name: '💳 Métodos de Pagamento',
                    value: paymentMethods.length > 1024 ? paymentMethods.substring(0, 1021) + '...' : paymentMethods,
                    inline: false
                },
                {
                    name: '📦 Itens do Pedido',
                    value: items.map((item, index) =>
                        `${index + 1}. **${item.skin_name}** - ${item.skin_price.toLocaleString()} RP`
                    ).join('\n'),
                    inline: false
                },
                {
                    name: '📝 Próximos Passos',
                    value:
                        '1️⃣ Clique em **"Confirmar Pedido"**\n' +
                        '2️⃣ Realize o pagamento usando um dos métodos acima\n' +
                        '3️⃣ Envie o comprovante neste canal\n' +
                        '4️⃣ Aguarde nossa aprovação\n' +
                        '5️⃣ Receba os itens na conta selecionada',
                    inline: false
                }
            ])
            .setColor('#00ff00')
            .setFooter({ text: `Carrinho ID: ${cartId} | Conta: ${selectedAccount.nickname}` })
            .setTimestamp();

        // ⭐ BOTÕES DE AÇÃO
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`confirm_checkout_${cartId}`)
                    .setLabel('✅ Confirmar Pedido')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`checkout_${cartId}`)
                    .setLabel('◀️ Escolher Outra Conta')
                    .setStyle(ButtonStyle.Secondary)
            );

        await interaction.editReply({
            embeds: [confirmationEmbed],
            components: [actionRow]
        });

        console.log(`[DEBUG SelectMenu] Checkout account selection completed successfully`);

    } catch (error) {
        console.error('[ERROR SelectMenu] Error handling checkout account selection:', error);
        console.error('[ERROR SelectMenu] Stack:', error.stack);

        try {
            await interaction.followUp({
                content: '❌ Erro ao processar seleção de conta.',
                ephemeral: true
            });
        } catch (followUpError) {
            console.error('[ERROR SelectMenu] FollowUp error:', followUpError);
        }
    }
}

async function handleAccountSelection(interaction) {
    try {
        console.log(`[DEBUG SelectMenu] Account selection started`);
        await interaction.deferUpdate();

        const orderId = interaction.customId.split('_')[2];
        const selectedAccountId = interaction.values[0];

        console.log(`[DEBUG SelectMenu] Processing account selection: Order ${orderId}, Account ${selectedAccountId}`);

        const OrderService = require('../services/orderService');

        if (!OrderService.processAccountSelection) {
            console.error(`[ERROR SelectMenu] OrderService.processAccountSelection not found`);
            return await interaction.followUp({
                content: '❌ Método de processamento não encontrado.',
                ephemeral: true
            });
        }

        await OrderService.processAccountSelection(interaction, orderId, selectedAccountId);
        console.log(`[DEBUG SelectMenu] Account selection completed`);

    } catch (error) {
        console.error('[ERROR SelectMenu] Error handling account selection:', error);
        console.error('[ERROR SelectMenu] Stack:', error.stack);

        try {
            await interaction.followUp({
                content: '❌ Erro ao processar seleção de conta.',
                ephemeral: true
            });
        } catch (followUpError) {
            console.error('[ERROR SelectMenu] FollowUp error:', followUpError);
        }
    }
}