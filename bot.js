const { Client, GatewayIntentBits } = require('discord.js');
const OrderLog = require('./models/OrderLog');
const OrderService = require('./services/orderService');
const config = require('./config.json');
const fs = require('fs');
const path = require('path');
const { applyDatabaseFixes } = require('./database/schema-fix');
const revenueCommand = require('./commands/slash/revenue');
const friendshipLogsCommand = require('./commands/slash/friendship-logs');

// Import auto-updater
const CatalogAutoUpdater = require('./CatalogAutoUpdater');

// ⭐ CORREÇÃO DO IMPORT
const FriendshipNotificationService = require('./services/FriendshipNotificationService');

// Check if required files exist
const requiredFiles = [
    './database/connection.js',
    './database/migrations.js',
    './handlers/buttonHandler.js',
    './handlers/selectMenuHandler.js',
    './handlers/modalHandler.js',
    './commands/slash/send-panel.js',
    './commands/slash/account.js'
];

console.log('Checking required files...');
for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
        console.error(`❌ Missing file: ${file}`);
        console.log('Please make sure all required files are in the correct location.');
        process.exit(1);
    }
}
console.log('✅ All required files found!');

// Import modules after verification
const Database = require('./database/connection');
const { runMigrations } = require('./database/migrations');

// Import handlers
const buttonHandler = require('./handlers/buttonHandler');
const selectMenuHandler = require('./handlers/selectMenuHandler');
const modalHandler = require('./handlers/modalHandler');

// Import commands
const sendPanelCommand = require('./commands/slash/send-panel');
const accountCommand = require('./commands/slash/account');
const priceManageCommand = require('./commands/slash/price-manage');

// Initialize client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Initialize services
let catalogUpdater;
let friendshipNotificationService;

// Bot ready event
client.once('ready', async () => {
    console.log(`🚀 ${client.user.tag} está online!`);

    // Initialize database
    try {
        await Database.initialize();
        await applyDatabaseFixes();
        await runMigrations();
        console.log('✅ Database initialized!');
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        process.exit(1);
    }

    // Initialize catalog auto-updater
    catalogUpdater = new CatalogAutoUpdater(client);
    console.log('🔄 Catalog auto-updater initialized!');

    // ⭐ INICIALIZAR SERVIÇO DE NOTIFICAÇÃO DE AMIZADES
    friendshipNotificationService = new FriendshipNotificationService(client);
    await friendshipNotificationService.start();
    console.log('🔔 Friendship notification service initialized!');
    global.friendshipNotificationService = friendshipNotificationService;

    // Clean up old backups every day
    setInterval(() => {
        catalogUpdater.cleanupOldBackups(7); // Keep backups for 7 days
    }, 24 * 60 * 60 * 1000); // Run every 24 hours
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.guild) return;

    if (message.attachments.size > 0) {
        console.log(`[DEBUG] Message with attachment in channel ${message.channel.id}`);

        try {
            const order = await OrderLog.findActiveOrderByChannelId(
                message.channel.id,
                'PENDING_PAYMENT_PROOF'
            );

            console.log(`[DEBUG] Order found:`, order ? `ID ${order.id}` : 'none');

            if (order && order.user_id === message.author.id) {
                console.log(`[DEBUG] Processing payment proof for order ${order.id}`);

                const attachment = message.attachments.first();
                if (attachment && attachment.contentType && attachment.contentType.startsWith('image/')) {
                    console.log(`[DEBUG] Valid image attachment received: ${attachment.url}`);

                    // Confirmar recebimento
                    await message.reply('✅ Comprovante de pagamento recebido! Nossa equipe irá analisar em breve.');

                    // ⭐ ATUALIZAR COM FALLBACK DIRETO
                    console.log(`[DEBUG] Updating order ${order.id} with payment proof...`);

                    let updateSuccess = false;

                    try {
                        // Tentar método normal com timeout
                        updateSuccess = await Promise.race([
                            OrderLog.addPaymentProof(order.id, attachment.url),
                            new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('addPaymentProof timeout')), 5000)
                            )
                        ]);

                        console.log(`[DEBUG] OrderLog.addPaymentProof result:`, updateSuccess);

                    } catch (error) {
                        console.error(`[ERROR] OrderLog.addPaymentProof failed:`, error);
                        console.log(`[DEBUG] Trying direct database update...`);

                        // ⭐ FALLBACK: Atualização direta no banco
                        try {
                            const db = require('./database/connection');
                            const directResult = await db.run(
                                'UPDATE order_logs SET payment_proof_url = ?, status = ? WHERE id = ?',
                                [attachment.url, 'PENDING_MANUAL_APPROVAL', order.id]
                            );

                            updateSuccess = directResult.changes > 0;
                            console.log(`[DEBUG] Direct database update result:`, updateSuccess);

                        } catch (directError) {
                            console.error(`[ERROR] Direct database update failed:`, directError);
                            await message.followUp('❌ Erro ao processar comprovante. Tente novamente.');
                            return;
                        }
                    }

                    if (!updateSuccess) {
                        console.error(`[ERROR] Failed to update order ${order.id}`);
                        await message.followUp('❌ Erro ao atualizar pedido. Contate o suporte.');
                        return;
                    }

                    // ⭐ ENVIAR PARA ADMIN
                    console.log(`[DEBUG] Sending order ${order.id} to admin approval...`);

                    try {
                        // Verificar se OrderService existe
                        if (!OrderService || typeof OrderService.sendOrderToAdminApproval !== 'function') {
                            console.error(`[ERROR] OrderService not available, using manual notification`);

                            // ⭐ FALLBACK: Notificação manual
                            const adminChannelId = config.adminLogChannelId || config.approvalNeededChannelId || config.orderApprovalChannelId;
                            if (adminChannelId) {
                                const adminChannel = await message.client.channels.fetch(adminChannelId);
                                if (adminChannel) {
                                    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

                                    const quickEmbed = new EmbedBuilder()
                                        .setTitle('🧾 Novo Comprovante')
                                        .setDescription(`**Pedido ID:** ${order.id}\n**Canal:** <#${message.channel.id}>`)
                                        .setImage(attachment.url)
                                        .setColor('#faa61a');

                                    const quickRow = new ActionRowBuilder()
                                        .addComponents(
                                            new ButtonBuilder()
                                                .setCustomId(`approve_order_${order.id}`)
                                                .setLabel('✅ Aprovar')
                                                .setStyle(ButtonStyle.Success),
                                            new ButtonBuilder()
                                                .setCustomId(`reject_order_${order.id}`)
                                                .setLabel('❌ Rejeitar')
                                                .setStyle(ButtonStyle.Danger)
                                        );

                                    await adminChannel.send({
                                        content: `🔔 **Comprovante recebido** - Pedido #${order.id}`,
                                        embeds: [quickEmbed],
                                        components: [quickRow]
                                    });

                                    console.log(`[DEBUG] Manual admin notification sent`);
                                }
                            }

                        } else {
                            // Usar OrderService normalmente
                            await OrderService.sendOrderToAdminApproval(message.client, order.id);
                            console.log(`[DEBUG] OrderService notification sent`);
                        }

                    } catch (adminError) {
                        console.error(`[ERROR] Admin notification failed:`, adminError);
                        // Não falhar aqui, apenas logar
                    }

                    console.log(`[DEBUG] Payment proof processing completed for order ${order.id}`);

                } else {
                    console.log(`[DEBUG] Invalid attachment type:`, attachment?.contentType);
                    await message.reply('⚠️ Por favor, envie um comprovante em formato de imagem (PNG, JPG, etc.).');
                }
            }
        } catch (error) {
            console.error('[ERROR] Error processing payment proof:', error);
            console.error('[ERROR] Error stack:', error.stack);
        }
    }
});

// Interaction handler
client.on('interactionCreate', async (interaction) => {
    try {
        if (interaction.isChatInputCommand()) {
            // Handle slash commands
            switch (interaction.commandName) {
                case 'friendship-admin':
                    const friendshipAdminCommand = require('./commands/slash/friendship-admin');
                    await friendshipAdminCommand.execute(interaction);
                    break;
                case 'friendship-logs':
                    await friendshipLogsCommand.execute(interaction);
                    break;
                case 'revenue':
                    await revenueCommand.execute(interaction);
                    break;
                case 'send-panel':
                    await sendPanelCommand.execute(interaction);
                    break;
                case 'account':
                    await accountCommand.execute(interaction);
                    break;
                case 'catalog-manage':
                    await catalogUpdater.handleCatalogCommand(interaction);
                    break;
                case 'friendship-notifications':
                    await handleFriendshipNotificationCommand(interaction);
                    break;
                default:
                    console.log(`Unknown command: ${interaction.commandName}`);
            }
        } else if (interaction.isButton()) {
            // Handle button interactions
            await buttonHandler.handle(interaction);
        } else if (interaction.isStringSelectMenu()) {
            // Handle select menu interactions
            await selectMenuHandler.handle(interaction);
        } else if (interaction.isModalSubmit()) {
            // Handle modal submissions
            await modalHandler.handle(interaction);
        }
    } catch (error) {
        console.error('Error handling interaction:', error);

        const errorMessage = 'Houve um erro ao processar sua solicitação.';

        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        } catch (followUpError) {
            console.error('Error sending error message:', followUpError);
        }
    }
});

// ⭐ HANDLERS PARA COMANDOS DE NOTIFICAÇÃO DE AMIZADES
async function handleFriendshipNotificationCommand(interaction) {
    // Check if user has admin role
    if (!interaction.member.roles.cache.has(config.adminRoleId)) {
        return await interaction.reply({
            content: '❌ Você não tem permissão para usar este comando.',
            ephemeral: true
        });
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
        case 'stats':
            await handleNotificationStats(interaction);
            break;
        case 'check':
            await handleManualCheck(interaction);
            break;
        case 'test':
            await handleTestNotification(interaction);
            break;
        case 'reset':
            await handleResetNotifications(interaction);
            break;
    }
}

async function handleNotificationStats(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const stats = await friendshipNotificationService.getStatistics();

        if (!stats) {
            return await interaction.editReply({
                content: '❌ Erro ao obter estatísticas.'
            });
        }

        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
            .setTitle('📊 Estatísticas do Serviço de Notificação')
            .setDescription(`Serviço de notificações de elegibilidade para presentes`)
            .addFields([
                { name: '👥 Total de Amizades', value: `${stats.totalFriendships} amizades`, inline: true },
                { name: '✅ Amizades Elegíveis', value: `${stats.eligibleFriendships} (${stats.minDays}+ dias)`, inline: true },
                { name: '🔔 Já Notificadas', value: `${stats.notifiedFriendships}`, inline: true },
                { name: '⏳ Pendentes', value: `${stats.pendingNotifications}`, inline: true },
                { name: '🔄 Status do Serviço', value: stats.isRunning ? '🟢 Ativo' : '🔴 Inativo', inline: true },
                { name: '⏰ Período Mínimo', value: `${stats.minDays} dias`, inline: true },
                { name: '🕐 Última Verificação', value: stats.lastCheck ? `<t:${Math.floor(new Date(stats.lastCheck).getTime() / 1000)}:R>` : 'N/A', inline: false }
            ])
            .setColor(stats.isRunning ? '#57f287' : '#ed4245')
            .setThumbnail(interaction.guild.iconURL())
            .setFooter({ text: `Sistema PawStore | Admin: ${interaction.user.tag}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Error getting notification stats:', error);
        await interaction.editReply({
            content: '❌ Erro ao obter estatísticas.'
        });
    }
}

async function handleManualCheck(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const { EmbedBuilder } = require('discord.js');
        const initialEmbed = new EmbedBuilder()
            .setTitle('🔄 Verificação Manual Iniciada')
            .setDescription('Verificando amizades elegíveis para notificação...')
            .setColor('#faa61a')
            .setTimestamp();

        await interaction.editReply({ embeds: [initialEmbed] });

        // Executar verificação
        await friendshipNotificationService.checkEligibleFriendships();

        // Obter estatísticas atualizadas
        const stats = await friendshipNotificationService.getStatistics();

        const resultEmbed = new EmbedBuilder()
            .setTitle('✅ Verificação Manual Concluída')
            .setDescription('A verificação de amizades foi executada com sucesso!')
            .addFields([
                { name: '📊 Resultado', value: `${stats.pendingNotifications} notificações pendentes processadas`, inline: false },
                { name: '🕐 Executado em', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                { name: '👨‍💼 Executado por', value: `${interaction.user}`, inline: true }
            ])
            .setColor('#57f287')
            .setTimestamp();

        await interaction.editReply({ embeds: [resultEmbed] });

    } catch (error) {
        console.error('Error running manual check:', error);

        const { EmbedBuilder } = require('discord.js');
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Erro na Verificação')
            .setDescription('Ocorreu um erro durante a verificação manual.')
            .addFields([
                { name: '🐛 Erro', value: error.message || 'Erro desconhecido', inline: false }
            ])
            .setColor('#ed4245')
            .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
    }
}

async function handleTestNotification(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const friendshipId = interaction.options.getInteger('friendship_id');

        const { EmbedBuilder } = require('discord.js');
        const testEmbed = new EmbedBuilder()
            .setTitle('🧪 Testando Notificação')
            .setDescription(`Enviando notificação de teste para amizade **${friendshipId}**...`)
            .setColor('#faa61a')
            .setTimestamp();

        await interaction.editReply({ embeds: [testEmbed] });

        const success = await friendshipNotificationService.checkSpecificFriendship(friendshipId);

        const resultEmbed = new EmbedBuilder()
            .setTitle(success ? '✅ Teste Bem-sucedido' : '❌ Teste Falhado')
            .setDescription(
                success
                    ? `Notificação enviada com sucesso para amizade **${friendshipId}**!`
                    : `Falha ao enviar notificação para amizade **${friendshipId}**.\n\nPossíveis motivos:\n• Amizade não encontrada\n• Não elegível ainda\n• Já foi notificada\n• DMs desabilitadas`
            )
            .addFields([
                { name: '🆔 Amizade testada', value: friendshipId.toString(), inline: true },
                { name: '🕐 Testado em', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            ])
            .setColor(success ? '#57f287' : '#ed4245')
            .setTimestamp();

        await interaction.editReply({ embeds: [resultEmbed] });

    } catch (error) {
        console.error('Error testing notification:', error);

        const { EmbedBuilder } = require('discord.js');
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Erro no Teste')
            .setDescription('Ocorreu um erro durante o teste de notificação.')
            .setColor('#ed4245')
            .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
    }
}

async function handleResetNotifications(interaction) {
    try {
        await interaction.deferReply({ ephemeral: true });

        const { EmbedBuilder } = require('discord.js');
        const warningEmbed = new EmbedBuilder()
            .setTitle('⚠️ ATENÇÃO - Reset de Notificações')
            .setDescription(
                '**Esta ação irá resetar TODAS as notificações de amizade!**\n\n' +
                '🔄 Isso significa que todas as amizades elegíveis receberão notificações novamente na próxima verificação.\n\n' +
                '⏰ **O reset será executado em 10 segundos...**\n' +
                '❌ Esta ação não pode ser desfeita!'
            )
            .setColor('#ed4245')
            .setTimestamp();

        await interaction.editReply({ embeds: [warningEmbed] });

        // Aguardar 10 segundos
        await new Promise(resolve => setTimeout(resolve, 10000));

        try {
            const resetCount = await friendshipNotificationService.resetNotifications();

            const successEmbed = new EmbedBuilder()
                .setTitle('✅ Reset Concluído')
                .setDescription(`**${resetCount} notificações foram resetadas com sucesso!**`)
                .addFields([
                    { name: '📊 Resetadas', value: `${resetCount} amizades`, inline: true },
                    { name: '🕐 Resetado em', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true },
                    { name: '👨‍💼 Executado por', value: `${interaction.user}`, inline: true }
                ])
                .setColor('#57f287')
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });
        } catch (resetError) {
            const errorEmbed = new EmbedBuilder()
                .setTitle('❌ Erro no Reset')
                .setDescription('Ocorreu um erro durante o reset das notificações.')
                .setColor('#ed4245')
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }

    } catch (error) {
        console.error('Error resetting notifications:', error);

        const { EmbedBuilder } = require('discord.js');
        const errorEmbed = new EmbedBuilder()
            .setTitle('❌ Erro')
            .setDescription('Erro ao processar reset de notificações.')
            .setColor('#ed4245')
            .setTimestamp();

        await interaction.editReply({ embeds: [errorEmbed] });
    }
}

// Error handling
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Shutting down bot...');

    // ⭐ PARAR SERVIÇOS ANTES DE FECHAR
    if (friendshipNotificationService) {
        friendshipNotificationService.stop();
    }

    client.destroy();
    process.exit(0);
});

// Login with error handling
client.login(config.token).catch(error => {
    console.error('Failed to login:', error);
    console.log('Please check your bot token in config.json');
    process.exit(1);
});