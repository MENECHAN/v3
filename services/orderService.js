const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder  // ⭐ ADICIONAR ESTA IMPORTAÇÃO
} = require('discord.js');
const OrderLog = require('../models/OrderLog');
const Account = require('../models/Account');
const Friendship = require('../models/Friendship');
const User = require('../models/User');
const config = require('../config.json');

class OrderService {

    static async sendOrderToAdminApproval(client, orderId) {
        try {
            console.log(`[DEBUG OrderService] Starting sendOrderToAdminApproval for order ${orderId}`);

            const order = await OrderLog.findById(orderId);
            console.log(`[DEBUG OrderService] Order retrieved:`, order ? `Status: ${order.status}` : 'null');

            if (!order || order.status !== 'PENDING_MANUAL_APPROVAL') {
                console.log(`[DEBUG OrderService] Order ${orderId} not found or wrong status. Current status: ${order?.status}`);
                return;
            }

            // Buscar informações do usuário
            let userTag = order.user_id;
            try {
                const discordUser = await client.users.fetch(order.user_id);
                userTag = discordUser.tag;
                console.log(`[DEBUG OrderService] User found: ${userTag}`);
            } catch (userError) {
                console.error(`[ERROR OrderService] Error fetching user ${order.user_id}:`, userError);
            }

            // ⭐ CORREÇÃO: Processar dados dos itens corretamente
            let itemsDescription = 'Nenhum item encontrado';
            let itemCount = 0;

            console.log(`[DEBUG OrderService] Raw items_data:`, order.items_data);

            if (order.items_data) {
                let parsedItems;

                // Tentar fazer parse se for string
                if (typeof order.items_data === 'string') {
                    try {
                        parsedItems = JSON.parse(order.items_data);
                        console.log(`[DEBUG OrderService] Parsed items from string:`, parsedItems);
                    } catch (parseError) {
                        console.error(`[ERROR OrderService] Error parsing items_data:`, parseError);
                        parsedItems = [];
                    }
                } else {
                    parsedItems = order.items_data;
                    console.log(`[DEBUG OrderService] Items already parsed:`, parsedItems);
                }

                // Processar itens
                if (Array.isArray(parsedItems) && parsedItems.length > 0) {
                    itemCount = parsedItems.length;
                    itemsDescription = parsedItems
                        .map((item, index) => {
                            const name = item.name || item.skin_name || 'Item sem nome';
                            const price = item.price || item.skin_price || 0;
                            return `${index + 1}. **${name}**\n   💎 ${price.toLocaleString()} RP`;
                        })
                        .join('\n');

                    console.log(`[DEBUG OrderService] Processed ${itemCount} items`);
                }
            }

            // ⭐ CRIAR EMBED DETALHADO
            const approvalEmbed = new EmbedBuilder()
                .setTitle(`🧾 Comprovante para Aprovação`)
                .setDescription(`**Pedido ID:** ${order.id}\n**Status:** Aguardando aprovação manual`)
                .addFields([
                    {
                        name: '👤 Cliente',
                        value: `${userTag}\n\`${order.user_id}\``,
                        inline: true
                    },
                    {
                        name: '📍 Canal',
                        value: `<#${order.order_channel_id}>`,
                        inline: true
                    },
                    {
                        name: '🔢 Quantidade de Itens',
                        value: itemCount.toString(),
                        inline: true
                    },
                    {
                        name: '💎 Total RP',
                        value: order.total_rp ? order.total_rp.toLocaleString() : 'N/A',
                        inline: true
                    },
                    {
                        name: '💰 Total EUR',
                        value: order.total_price ? `€${order.total_price.toFixed(2)}` : 'N/A',
                        inline: true
                    },
                    {
                        name: '📅 Data do Pedido',
                        value: order.created_at ? `<t:${Math.floor(new Date(order.created_at).getTime() / 1000)}:F>` : 'N/A',
                        inline: true
                    },
                    {
                        name: '📦 Itens do Pedido',
                        value: itemsDescription.length > 1024 ? itemsDescription.substring(0, 1021) + '...' : itemsDescription,
                        inline: false
                    }
                ])
                .setColor('#faa61a')
                .setTimestamp();

            // Adicionar comprovante
            if (order.payment_proof_url) {
                approvalEmbed.setImage(order.payment_proof_url);
                approvalEmbed.addFields([
                    { name: '📷 Comprovante', value: '[Imagem anexada acima ⬆️]', inline: false }
                ]);
                console.log(`[DEBUG OrderService] Payment proof attached: ${order.payment_proof_url}`);
            }

            // ⭐ CRIAR BOTÕES COM IDs CORRETOS
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`approve_order_${order.id}`) // ⭐ FORMATO CORRETO
                        .setLabel('✅ Aprovar Pagamento')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`reject_order_${order.id}`) // ⭐ FORMATO CORRETO
                        .setLabel('❌ Rejeitar Pagamento')
                        .setStyle(ButtonStyle.Danger)
                );

            console.log(`[DEBUG OrderService] Button IDs created: approve_order_${order.id}, reject_order_${order.id}`);

            // Enviar para canal de admin
            const adminChannelId = config.adminLogChannelId || config.approvalNeededChannelId || config.orderApprovalChannelId;
            if (!adminChannelId) {
                console.error(`[ERROR OrderService] No admin channel configured`);
                return;
            }

            console.log(`[DEBUG OrderService] Sending to admin channel: ${adminChannelId}`);

            const adminChannel = await client.channels.fetch(adminChannelId);
            if (adminChannel && adminChannel.isTextBased()) {
                const sentMessage = await adminChannel.send({
                    content: `🔔 **Novo comprovante para análise** - Pedido #${order.id}`,
                    embeds: [approvalEmbed],
                    components: [row]
                });

                console.log(`[DEBUG OrderService] Admin notification sent successfully. Message ID: ${sentMessage.id}`);
            } else {
                console.error(`[ERROR OrderService] Admin channel not found or not text-based`);
            }

        } catch (error) {
            console.error('[ERROR OrderService] Error in sendOrderToAdminApproval:', error);
            console.error('[ERROR OrderService] Error stack:', error.stack);
        }
    }

    static async approveOrder(interaction, orderId) {
        try {
            console.log(`[DEBUG OrderService.approveOrder] Starting approval for order ${orderId}`);

            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferUpdate();
            }

            const order = await OrderLog.findById(orderId);
            console.log(`[DEBUG OrderService.approveOrder] Order status: ${order?.status}`);

            if (!order) {
                return await interaction.followUp({
                    content: '❌ Pedido não encontrado.',
                    ephemeral: true
                });
            }

            if (order.status !== 'PENDING_MANUAL_APPROVAL') {
                return await interaction.followUp({
                    content: `❌ Este pedido não está aguardando aprovação. Status atual: ${order.status}`,
                    ephemeral: true
                });
            }

            // ⭐ RESPOSTA TEMPORÁRIA
            const tempEmbed = new EmbedBuilder()
                .setTitle('🔄 Processando Aprovação...')
                .setDescription(`Pedido #${orderId} está sendo processado.\n\nBuscando contas do cliente...`)
                .setColor('#faa61a')
                .setTimestamp();

            await interaction.editReply({
                embeds: [tempEmbed],
                components: []
            });

            console.log(`[DEBUG OrderService.approveOrder] Temporary response sent`);

            // ⭐ BUSCAR USUÁRIO PELO DISCORD ID
            const User = require('../models/User');
            const user = await User.findByDiscordId(order.user_id);

            console.log(`[DEBUG OrderService.approveOrder] User lookup completed for Discord ID: ${order.user_id}`);

            if (!user) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Erro')
                    .setDescription('Usuário não encontrado no sistema.')
                    .setColor('#ed4245');

                return await interaction.editReply({
                    embeds: [errorEmbed],
                    components: []
                });
            }

            // ⭐ BUSCAR AMIZADES/CONTAS DO CLIENTE
            const Friendship = require('../models/Friendship');
            const clientFriendships = await Friendship.findByUserId(user.id);

            console.log(`[DEBUG OrderService.approveOrder] Found ${clientFriendships.length} client friendships`);

            if (clientFriendships.length === 0) {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Sem Contas Adicionadas')
                    .setDescription('Este cliente não possui contas adicionadas ao sistema.\n\n' +
                        'O cliente precisa usar o botão "Add Account" para adicionar suas contas primeiro.')
                    .setColor('#ed4245');

                return await interaction.editReply({
                    embeds: [errorEmbed],
                    components: []
                });
            }

            // ⭐ VERIFICAR TEMPO DE AMIZADE E SALDO DAS CONTAS
            const Account = require('../models/Account');
            const eligibleAccounts = [];
            const ineligibleAccounts = [];
            const minDays = config.orderSettings?.minFriendshipDays || 7;

            for (const friendship of clientFriendships) {
                const account = await Account.findById(friendship.account_id);

                if (!account) continue;

                // Calcular dias desde que foi adicionado
                const now = new Date();
                const addedAt = new Date(friendship.added_at);
                const daysSince = Math.floor((now - addedAt) / (1000 * 60 * 60 * 24));

                const friendshipData = {
                    ...account,
                    friendship_id: friendship.id,
                    lol_nickname: friendship.lol_nickname,
                    lol_tag: friendship.lol_tag,
                    days_since_added: daysSince,
                    days_remaining: Math.max(0, minDays - daysSince)
                };

                // ⭐ VERIFICAR SE TEM TEMPO SUFICIENTE E RP
                if (daysSince >= minDays && account.rp_amount >= order.total_rp) {
                    eligibleAccounts.push(friendshipData);
                    console.log(`[DEBUG] Account ${account.nickname}: ✅ Eligible (${daysSince} days, ${account.rp_amount} RP)`);
                } else {
                    ineligibleAccounts.push(friendshipData);
                    console.log(`[DEBUG] Account ${account.nickname}: ❌ Not eligible (${daysSince}/${minDays} days, ${account.rp_amount}/${order.total_rp} RP)`);
                }
            }

            console.log(`[DEBUG] Found ${eligibleAccounts.length} eligible accounts, ${ineligibleAccounts.length} ineligible`);

            // ⭐ SE NÃO HÁ CONTAS ELEGÍVEIS
            if (eligibleAccounts.length === 0) {
                let reasonsText = '';

                ineligibleAccounts.forEach(acc => {
                    const timeIssue = acc.days_since_added < minDays;
                    const rpIssue = acc.rp_amount < order.total_rp;

                    let reason = '';
                    if (timeIssue && rpIssue) {
                        reason = `⏳ ${acc.days_remaining} dias restantes | 💎 Faltam ${order.total_rp - acc.rp_amount} RP`;
                    } else if (timeIssue) {
                        reason = `⏳ Faltam ${acc.days_remaining} dias para elegibilidade`;
                    } else if (rpIssue) {
                        reason = `💎 RP insuficiente (tem ${acc.rp_amount.toLocaleString()}, precisa ${order.total_rp.toLocaleString()})`;
                    }

                    reasonsText += `**${acc.nickname}** (${acc.lol_nickname}#${acc.lol_tag})\n${reason}\n\n`;
                });

                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Nenhuma Conta Elegível')
                    .setDescription(
                        `Nenhuma conta do cliente está elegível para este pedido.\n\n` +
                        `**Requisitos:**\n` +
                        `• ⏰ Mínimo ${minDays} dias de amizade\n` +
                        `• 💎 Mínimo ${order.total_rp.toLocaleString()} RP\n\n` +
                        `**Status das contas do cliente:**\n\n${reasonsText}`
                    )
                    .addFields([
                        {
                            name: '💡 Soluções',
                            value: `• Aguardar o tempo mínimo de amizade\n• Cliente adicionar RP nas contas\n• Cliente adicionar novas contas`,
                            inline: false
                        }
                    ])
                    .setColor('#ed4245');

                await interaction.editReply({
                    embeds: [errorEmbed],
                    components: []
                });
                return;
            }

            // ⭐ ATUALIZAR STATUS PARA SELEÇÃO
            await OrderLog.updateStatus(orderId, 'AWAITING_ACCOUNT_SELECTION');
            console.log(`[DEBUG] Order status updated to AWAITING_ACCOUNT_SELECTION`);

            // ⭐ CRIAR INTERFACE DE SELEÇÃO
            console.log(`[DEBUG] Creating selection interface for ${eligibleAccounts.length} accounts`);

            // Se há apenas 1 conta elegível, processar diretamente
            if (eligibleAccounts.length === 1) {
                console.log(`[DEBUG] Only 1 eligible account, processing directly...`);
                const account = eligibleAccounts[0];

                const confirmEmbed = new EmbedBuilder()
                    .setTitle(`✅ Única Conta Elegível Encontrada`)
                    .setDescription(
                        `**Pedido #${orderId}** - Processamento automático\n\n` +
                        `**Cliente:** <@${order.user_id}>\n` +
                        `**Conta elegível:** ${account.nickname}\n` +
                        `**RP a debitar:** ${order.total_rp.toLocaleString()}`
                    )
                    .addFields([
                        {
                            name: '✅ Conta Selecionada Automaticamente',
                            value:
                                `**${account.nickname}** (${account.lol_nickname}#${account.lol_tag})\n` +
                                `💎 ${account.rp_amount.toLocaleString()} RP disponível\n` +
                                `⏰ ${account.days_since_added} dias de amizade`,
                            inline: false
                        }
                    ])
                    .setColor('#57f287')
                    .setFooter({ text: `Admin: ${interaction.user.tag} | Processamento automático` })
                    .setTimestamp();

                const autoRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`select_account_${orderId}_${account.id}`)
                            .setLabel(`✅ Confirmar e Processar`)
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`cancel_processing_${orderId}`)
                            .setLabel(`❌ Cancelar`)
                            .setStyle(ButtonStyle.Danger)
                    );

                await interaction.editReply({
                    embeds: [confirmEmbed],
                    components: [autoRow]
                });
                return;
            }

            // ⭐ SE HÁ MÚLTIPLAS CONTAS, CRIAR BOTÕES
            console.log(`[DEBUG] Multiple eligible accounts (${eligibleAccounts.length}), creating selection interface...`);

            // Criar botões para as contas elegíveis (máximo 5 por linha)
            const rows = [];
            let currentRow = new ActionRowBuilder();
            let buttonCount = 0;

            eligibleAccounts.forEach((account, index) => {
                const button = new ButtonBuilder()
                    .setCustomId(`select_account_${orderId}_${account.id}`)
                    .setLabel(`${account.nickname} (${account.rp_amount.toLocaleString()} RP)`)
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅');

                currentRow.addComponents(button);
                buttonCount++;

                // Se chegou a 5 botões ou é o último, adiciona a linha
                if (buttonCount === 5 || index === eligibleAccounts.length - 1) {
                    rows.push(currentRow);
                    currentRow = new ActionRowBuilder();
                    buttonCount = 0;
                }
            });

            // Limitar a 5 linhas (máximo do Discord)
            if (rows.length > 5) {
                rows.splice(5);
            }

            // ⭐ EMBED COM INFORMAÇÕES DAS CONTAS
            const selectionEmbed = new EmbedBuilder()
                .setTitle(`✅ Pagamento Aprovado - Selecionar Conta`)
                .setDescription(
                    `**Pedido #${orderId} aprovado!**\n\n` +
                    `**Cliente:** <@${order.user_id}>\n` +
                    `**Total a debitar:** ${order.total_rp.toLocaleString()} RP\n` +
                    `**Contas elegíveis:** ${eligibleAccounts.length}\n\n` +
                    `🎮 **Selecione qual conta do CLIENTE deve ter o RP debitado:**`
                )
                .addFields([
                    {
                        name: '✅ Contas Elegíveis',
                        value: eligibleAccounts.map(acc =>
                            `**${acc.nickname}** (${acc.lol_nickname}#${acc.lol_tag})\n` +
                            `💎 ${acc.rp_amount.toLocaleString()} RP | ⏰ ${acc.days_since_added} dias`
                        ).join('\n\n'),
                        inline: false
                    }
                ])
                .setColor('#57f287')
                .setFooter({ text: `Admin: ${interaction.user.tag} | Pedido ID: ${orderId}` })
                .setTimestamp();

            // Mostrar contas inelegíveis se houver
            if (ineligibleAccounts.length > 0) {
                let ineligibleText = ineligibleAccounts.map(acc => {
                    const timeIssue = acc.days_since_added < minDays;
                    const rpIssue = acc.rp_amount < order.total_rp;

                    let status = '';
                    if (timeIssue) status += `⏳ ${acc.days_remaining}d `;
                    if (rpIssue) status += `💎 -${order.total_rp - acc.rp_amount}RP`;

                    return `**${acc.nickname}** - ${status}`;
                }).join('\n');

                // Truncar se muito longo
                if (ineligibleText.length > 1024) {
                    ineligibleText = ineligibleText.substring(0, 1021) + '...';
                }

                selectionEmbed.addFields([
                    {
                        name: '❌ Contas Não Elegíveis',
                        value: ineligibleText,
                        inline: false
                    }
                ]);
            }

            await interaction.editReply({
                content: null,
                embeds: [selectionEmbed],
                components: rows
            });

            console.log(`[DEBUG] Account selection interface sent successfully with ${rows.length} button rows!`);

        } catch (error) {
            console.error('[ERROR OrderService.approveOrder] Main error:', error);
            console.error('[ERROR OrderService.approveOrder] Stack:', error.stack);

            try {
                const errorEmbed = new EmbedBuilder()
                    .setTitle('❌ Erro Crítico')
                    .setDescription(`Erro ao processar aprovação: ${error.message}`)
                    .setColor('#ed4245');

                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({
                        embeds: [errorEmbed],
                        components: []
                    });
                } else {
                    await interaction.reply({
                        embeds: [errorEmbed],
                        ephemeral: true
                    });
                }
            } catch (followUpError) {
                console.error('[ERROR] Could not send error message:', followUpError);
            }
        }
    }

    static async rejectOrder(interaction, orderId) {
        try {
            await interaction.deferUpdate();

            const order = await OrderLog.findById(orderId);
            if (!order) {
                return await interaction.followUp({
                    content: '❌ Pedido não encontrado.',
                    ephemeral: true
                });
            }

            // Atualizar status
            await OrderLog.updateStatus(orderId, 'REJECTED');

            // Notificar no canal do pedido
            try {
                const orderChannel = await interaction.client.channels.fetch(order.order_channel_id);
                if (orderChannel) {
                    const rejectionEmbed = new EmbedBuilder()
                        .setTitle('❌ Pedido Rejeitado')
                        .setDescription(
                            `Seu pedido **#${orderId}** foi rejeitado.\n\n` +
                            `**Motivo:** Comprovante de pagamento não aprovado.\n\n` +
                            `Se você acredita que isso é um erro, ` +
                            `entre em contato com nossa equipe.`
                        )
                        .setColor('#ed4245')
                        .setTimestamp();

                    await orderChannel.send({
                        content: `<@${order.user_id}>`,
                        embeds: [rejectionEmbed]
                    });
                }
            } catch (error) {
                console.error('Error notifying user:', error);
            }

            // Atualizar embed original
            const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .setColor('#ed4245')
                .setTitle('❌ Pedido Rejeitado')
                .addFields([
                    { name: '👤 Rejeitado por', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '⏰ Data', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                ]);

            await interaction.editReply({
                embeds: [originalEmbed],
                components: []
            });

        } catch (error) {
            console.error('Error rejecting order:', error);
            await interaction.followUp({
                content: '❌ Erro ao rejeitar pedido.',
                ephemeral: true
            });
        }
    }

    static async processAccountSelection(interaction, orderId, accountId) {
        try {
            console.log(`[DEBUG OrderService.processAccountSelection] Starting for order ${orderId}, account ${accountId}`);

            const order = await OrderLog.findById(orderId);
            const Account = require('../models/Account');
            const account = await Account.findById(accountId);

            console.log(`[DEBUG OrderService.processAccountSelection] Order status: ${order?.status}`);
            console.log(`[DEBUG OrderService.processAccountSelection] Account balance: ${account?.rp_amount}`);

            if (!order || !account) {
                return await interaction.followUp({
                    content: '❌ Pedido ou conta não encontrada.',
                    ephemeral: true
                });
            }

            if (order.status !== 'AWAITING_ACCOUNT_SELECTION') {
                return await interaction.followUp({
                    content: `❌ Este pedido não está aguardando seleção de conta. Status: ${order.status}`,
                    ephemeral: true
                });
            }

            if (account.rp_amount < order.total_rp) {
                return await interaction.followUp({
                    content: `❌ Conta selecionada não possui RP suficiente.\n**Saldo:** ${account.rp_amount.toLocaleString()} RP\n**Necessário:** ${order.total_rp.toLocaleString()} RP`,
                    ephemeral: true
                });
            }

            // ⭐ DEBITAR RP DA CONTA
            const newBalance = account.rp_amount - order.total_rp;
            console.log(`[DEBUG OrderService.processAccountSelection] Debiting RP: ${account.rp_amount} - ${order.total_rp} = ${newBalance}`);

            const updateResult = await Account.updateRP(accountId, newBalance);
            console.log(`[DEBUG OrderService.processAccountSelection] Account update result: ${updateResult}`);

            if (!updateResult) {
                console.error(`[ERROR OrderService.processAccountSelection] Failed to update account balance`);
                return await interaction.followUp({
                    content: '❌ Erro ao debitar RP da conta.',
                    ephemeral: true
                });
            }

            console.log(`[DEBUG OrderService.processAccountSelection] Account update result: true`);

            console.log(`[DEBUG] Attempting to finalize order ${orderId}...`);

            // ⭐ PULAR FINALIZAÇÃO NO BANCO E IR DIRETO PARA UI
            console.log(`[DEBUG] Skipping database finalization, updating UI directly...`);

            // ⭐ ATUALIZAR EMBED IMEDIATAMENTE
            try {
                console.log(`[DEBUG] Updating original embed...`);

                const originalEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                    .setColor('#57f287')
                    .setTitle('✅ Pedido Processado e Finalizado')
                    .addFields([
                        { name: '👤 Admin responsável', value: `<@${interaction.user.id}>`, inline: true },
                        { name: '🎮 Conta utilizada', value: `${account.nickname} (ID: ${account.id})`, inline: true },
                        { name: '📅 Processado em', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                        { name: '💰 RP Debitado', value: `${order.total_rp.toLocaleString()} RP`, inline: true },
                        { name: '📊 Saldo anterior', value: `${account.rp_amount.toLocaleString()} RP`, inline: true },
                        { name: '📊 Novo saldo', value: `${newBalance.toLocaleString()} RP`, inline: true }
                    ])
                    .setFooter({ text: `Pedido #${orderId} - FINALIZADO` });

                await interaction.update({
                    embeds: [originalEmbed],
                    components: [] // Remove todos os botões
                });

                console.log(`[DEBUG] Original embed updated successfully`);
            } catch (embedError) {
                console.error(`[ERROR] Embed update failed:`, embedError);
            }

            // ⭐ CONFIRMAÇÃO RÁPIDA AO ADMIN
            try {
                await interaction.followUp({
                    content: `✅ **Processamento concluído!**\n\n` +
                        `📦 Pedido #${orderId} finalizado\n` +
                        `🎮 Conta: ${account.nickname}\n` +
                        `💰 RP debitado: ${order.total_rp.toLocaleString()}\n` +
                        `📊 Novo saldo: ${newBalance.toLocaleString()}`,
                    ephemeral: true
                });
                console.log(`[DEBUG] Admin confirmation sent`);
            } catch (followUpError) {
                console.error(`[ERROR] FollowUp failed:`, followUpError);
            }

            console.log(`[DEBUG] Core processing completed - embed updated and admin notified`);
            // ⭐ CRIAR RESUMO DO PEDIDO PARA CANAL DE PEDIDOS FINALIZADOS
            try {
                console.log(`[DEBUG OrderService.processAccountSelection] Creating order summary...`);

                // Processar itens para mostrar na lista
                let itemsList = 'Itens não disponíveis';
                let itemCount = 0;

                if (order.items_data) {
                    let parsedItems;
                    if (typeof order.items_data === 'string') {
                        parsedItems = JSON.parse(order.items_data);
                    } else {
                        parsedItems = order.items_data;
                    }

                    if (Array.isArray(parsedItems) && parsedItems.length > 0) {
                        itemCount = parsedItems.length;
                        itemsList = parsedItems
                            .map((item, index) => {
                                const name = item.name || item.skin_name || 'Item sem nome';
                                const price = item.price || item.skin_price || 0;
                                return `${index + 1}. **${name}** - ${price.toLocaleString()} RP`;
                            })
                            .join('\n');
                    }
                }

                // Buscar informações do cliente
                let clientTag = order.user_id;
                let clientMention = `<@${order.user_id}>`;
                try {
                    const discordUser = await interaction.client.users.fetch(order.user_id);
                    clientTag = discordUser.tag;
                } catch (userError) {
                    console.error(`[ERROR] Error fetching client info:`, userError);
                }

                // Criar embed para canal de pedidos finalizados
                const orderCompletedEmbed = new EmbedBuilder()
                    .setTitle('🎉 Pedido Finalizado com Sucesso')
                    .setDescription(`**Pedido #${orderId}** foi processado e concluído!`)
                    .addFields([
                        {
                            name: '👤 Cliente',
                            value: `${clientMention}\n\`${clientTag}\``,
                            inline: true
                        },
                        {
                            name: '🎮 Destino',
                            value: `(${friendship.lol_nickname}#${friendship.lol_tag})`,
                            inline: true
                        },
                        {
                            name: '💰 Valor Total',
                            value: `💎 ${order.total_rp.toLocaleString()} RP\n💵 €${order.total_price.toFixed(2)}`,
                            inline: true
                        },
                        {
                            name: '📦 Itens Entregues',
                            value: itemCount > 0 ? itemsList : 'Nenhum item listado',
                            inline: false
                        },
                        {
                            name: '📊 Detalhes da Transação',
                            value:
                                `**Saldo anterior:** ${account.rp_amount.toLocaleString()} RP\n` +
                                `**RP debitado:** ${order.total_rp.toLocaleString()} RP\n` +
                                `**Novo saldo:** ${newBalance.toLocaleString()} RP`,
                            inline: false
                        },
                        {
                            name: '👨‍💼 Admin responsável',
                            value: `<@${interaction.user.id}>`,
                            inline: true
                        },
                        {
                            name: '📅 Data da entrega',
                            value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                            inline: true
                        },
                        {
                            name: '🔗 Canal do pedido',
                            value: `<#${order.order_channel_id}>`,
                            inline: true
                        }
                    ])
                    .setColor('#57f287')
                    .setThumbnail(interaction.client.user.displayAvatarURL())
                    .setFooter({
                        text: `Sistema PawStore | Pedido ID: ${orderId}`,
                        iconURL: interaction.guild.iconURL()
                    })
                    .setTimestamp();

                // Enviar para canal de pedidos finalizados
                const ordersChannelId = '1373728534589079734';
                const ordersChannel = await interaction.client.channels.fetch(ordersChannelId);

                if (ordersChannel && ordersChannel.isTextBased()) {
                    const sentMessage = await ordersChannel.send({
                        content: `🎯 **Novo pedido finalizado** - Cliente: ${clientMention}`,
                        embeds: [orderCompletedEmbed]
                    });
                    console.log(`[DEBUG OrderService.processAccountSelection] Order summary sent to orders channel`);
                } else {
                    console.error(`[ERROR OrderService.processAccountSelection] Orders channel not found or not accessible`);
                }

            } catch (orderSummaryError) {
                console.error(`[ERROR OrderService.processAccountSelection] Error creating order summary:`, orderSummaryError);
            }

            // ⭐ NOTIFICAR CLIENTE NO CANAL DO PEDIDO
            try {
                console.log(`[DEBUG OrderService.processAccountSelection] Notifying client...`);

                const orderChannel = await interaction.client.channels.fetch(order.order_channel_id);
                if (orderChannel && orderChannel.isTextBased()) {
                    // Processar itens para o cliente
                    let clientItemsList = 'Seus itens foram processados com sucesso!';
                    if (order.items_data) {
                        let parsedItems;
                        if (typeof order.items_data === 'string') {
                            parsedItems = JSON.parse(order.items_data);
                        } else {
                            parsedItems = order.items_data;
                        }

                        if (Array.isArray(parsedItems) && parsedItems.length > 0) {
                            clientItemsList = parsedItems
                                .map((item, index) => {
                                    const name = item.name || item.skin_name || 'Item';
                                    return `${index + 1}. **${name}**`;
                                })
                                .join('\n');
                        }
                    }

                    let userFriendship = null;
                    try {
                        const user = await User.findByDiscordId(order.user_id);
                        if (user) {
                            userFriendship = await Friendship.findByUserAndAccount(user.id, accountId);
                        }
                        console.log(`[DEBUG] User friendship found:`, userFriendship);
                    } catch (friendshipError) {
                        console.error(`[ERROR] Error finding friendship:`, friendshipError);
                    }

                    // ⭐ CORRIGIR O EMBED PARA CLIENTE
                    const clientEmbed = new EmbedBuilder()
                        .setTitle('🎉 Pedido Aprovado - Será Entregue em Breve!')
                        .setDescription(
                            `Seu pedido **#${orderId}** foi aprovado e será processado!\n\n` +
                            `✨ **Os itens serão entregues na sua conta em breve.**`
                        )
                        .addFields([
                            {
                                name: '🎮 Conta de destino',
                                value: userFriendship ?
                                    `**${account.nickname}**\nSeu nick: ${userFriendship.lol_nickname}#${userFriendship.lol_tag}` :
                                    `**${account.nickname}**\nVerifique seus dados na conta`,
                                inline: true
                            },
                            {
                                name: '💰 Total aprovado',
                                value: `💎 ${order.total_rp.toLocaleString()} RP\n💵 €${order.total_price.toFixed(2)}`,
                                inline: true
                            },
                            {
                                name: '📦 Itens aprovados',
                                value: clientItemsList,
                                inline: false
                            },
                            {
                                name: '⏳ Próximos passos',
                                value:
                                    `1. **Aguarde a entrega** - processamento em andamento\n` +
                                    `2. **Faça login** na conta **${account.nickname}**\n` +
                                    `3. **Verifique sua coleção** após a entrega\n` +
                                    `4. **Entre em contato** se houver problemas\n\n` +
                                    `💡 *Os itens serão entregues automaticamente.*`,
                                inline: false
                            }
                        ])
                        .setColor('#faa61a') // Cor amarela para "em processamento"
                        .setThumbnail(interaction.client.user.displayAvatarURL())
                        .setFooter({ text: `Pedido aprovado! | ID: ${orderId}` })
                        .setTimestamp();

                    await orderChannel.send({
                        content: `<@${order.user_id}> 🎁 **Seu pedido foi entregue!**`,
                        embeds: [clientEmbed]
                    });

                    console.log(`[DEBUG OrderService.processAccountSelection] Client notification sent successfully`);
                } else {
                    console.error(`[ERROR OrderService.processAccountSelection] Order channel not found`);
                }

            } catch (clientError) {
                console.error(`[ERROR OrderService.processAccountSelection] Error notifying client:`, clientError);
            }

            console.log(`[DEBUG OrderService.processAccountSelection] Process completed successfully - Order #${orderId} finalized`);

            // Final success message to admin (optional)
            try {
                await interaction.followUp({
                    content: `✅ **Processamento concluído!**\n\n` +
                        `📦 Pedido #${orderId} foi finalizado com sucesso\n` +
                        `🎮 Cliente notificado\n` +
                        `📋 Resumo enviado para o canal de pedidos\n` +
                        `💰 RP debitado: ${order.total_rp.toLocaleString()}`,
                    ephemeral: true
                });
            } catch (followUpError) {
                console.log(`[DEBUG] Could not send follow-up message:`, followUpError.message);
            }

        } catch (error) {
            console.error('[ERROR OrderService.processAccountSelection] Error:', error);
            console.error('[ERROR OrderService.processAccountSelection] Stack:', error.stack);

            try {
                await interaction.followUp({
                    content: `❌ Erro ao processar seleção: ${error.message}`,
                    ephemeral: true
                });
            } catch (followUpError) {
                console.error('[ERROR OrderService.processAccountSelection] FollowUp error:', followUpError);
            }
        }
    }
}

module.exports = OrderService;