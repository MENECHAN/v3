// services/FriendshipNotificationService.js - Versão otimizada

const { EmbedBuilder } = require('discord.js');
const db = require('../database/connection');
const config = require('../config.json');

class FriendshipNotificationService {
    constructor(client) {
        this.client = client;
        this.checkInterval = 60000 * 60; // Verificar a cada 1 hora
        this.isRunning = false;
        this.interval = null;
    }

    // Inicializar coluna na primeira execução
    async initializeNotificationColumn() {
        try {
            const columns = await db.all("PRAGMA table_info(friendships)");
            const hasNotifiedColumn = columns.some(col => col.name === 'notified_7_days');

            if (!hasNotifiedColumn) {
                console.log('[FriendshipNotification] 🔧 Adding notified_7_days column...');
                await db.run('ALTER TABLE friendships ADD COLUMN notified_7_days TIMESTAMP NULL');
                console.log('[FriendshipNotification] ✅ Added notified_7_days column');
            }
        } catch (error) {
            console.error('[FriendshipNotification] Error initializing column:', error);
        }
    }

    // Iniciar o serviço de verificação automática
    async start() {
        if (this.isRunning) {
            console.log('[FriendshipNotification] Service already running');
            return;
        }

        // Inicializar coluna se necessário
        await this.initializeNotificationColumn();

        this.isRunning = true;
        console.log('[FriendshipNotification] 🔄 Service started');

        // Executar imediatamente
        this.checkEligibleFriendships();

        // Agendar verificações periódicas
        this.interval = setInterval(() => {
            this.checkEligibleFriendships();
        }, this.checkInterval);
    }

    // Parar o serviço
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.isRunning = false;
        console.log('[FriendshipNotification] 🛑 Service stopped');
    }

    // Verificar amizades elegíveis para notificação
    async checkEligibleFriendships() {
        try {
            console.log('[FriendshipNotification] 🔍 Checking eligible friendships...');

            const minDays = config.orderSettings?.minFriendshipDays || 7;
            
            // ⭐ CORRIGIR: Buscar amizades que completaram o tempo mínimo
            // e que ainda não foram notificadas
            const query = `
                SELECT 
                    f.*,
                    u.discord_id,
                    u.username,
                    a.nickname as account_nickname,
                    julianday('now') - julianday(f.added_at) as days_since_added
                FROM friendships f
                JOIN users u ON f.user_id = u.id
                JOIN accounts a ON f.account_id = a.id
                WHERE julianday('now') - julianday(f.added_at) >= ?
                AND (f.notified_7_days IS NULL OR f.notified_7_days = '')
                ORDER BY f.added_at ASC
                LIMIT 10
            `;

            const eligibleFriendships = await db.all(query, [minDays]);

            if (eligibleFriendships.length === 0) {
                console.log('[FriendshipNotification] ✅ No new eligible friendships found');
                return;
            }

            console.log(`[FriendshipNotification] 📬 Found ${eligibleFriendships.length} friendships to notify`);

            // Processar cada amizade elegível
            let successCount = 0;
            for (const friendship of eligibleFriendships) {
                try {
                    const success = await this.sendEligibilityNotification(friendship);
                    
                    if (success) {
                        await this.markAsNotified(friendship.id);
                        successCount++;
                    }
                    
                    // Aguardar um pouco entre notificações para evitar spam
                    await this.sleep(2000);
                } catch (friendshipError) {
                    console.error(`[FriendshipNotification] Error processing friendship ${friendship.id}:`, friendshipError);
                }
            }

            console.log(`[FriendshipNotification] ✅ Successfully processed ${successCount}/${eligibleFriendships.length} notifications`);

        } catch (error) {
            console.error('[FriendshipNotification] ❌ Error checking eligible friendships:', error);
        }
    }

    // Enviar notificação de elegibilidade para o usuário
    async sendEligibilityNotification(friendship) {
        try {
            if (!this.client || !this.client.user) {
                console.error('[FriendshipNotification] Client not available');
                return false;
            }

            const user = await this.client.users.fetch(friendship.discord_id);
            if (!user) {
                console.error(`[FriendshipNotification] Could not fetch user ${friendship.discord_id}`);
                return false;
            }

            const friendshipDate = new Date(friendship.added_at);
            const daysPassed = Math.floor(friendship.days_since_added);

            // ⭐ CRIAR EMBED MAIS ATRATIVO
            const embed = new EmbedBuilder()
                .setTitle('🎁 Parabéns! Você agora pode enviar presentes!')
                .setDescription(
                    `A conta **${friendship.account_nickname}** completou **${daysPassed} dias** de amizade com você!\n\n` +
                    `✨ **Detalhes da sua amizade:**\n` +
                    `🎮 **Conta:** ${friendship.account_nickname}\n` +
                    `🏷️ **Seu nick:** ${friendship.lol_nickname}#${friendship.lol_tag}\n` +
                    `📅 **Adicionado em:** ${friendshipDate.toLocaleDateString('pt-BR')}\n` +
                    `⏰ **Tempo de amizade:** ${daysPassed} dias`
                )
                .addFields([
                    {
                        name: '✅ Agora você pode:',
                        value: 
                            `🛒 Fazer pedidos de skins para esta conta\n` +
                            `🎮 Receber presentes diretamente no seu nick\n` +
                            `💎 Usar todos os recursos da loja\n` +
                            `🚀 Fazer checkout sem restrições`,
                        inline: false
                    },
                    {
                        name: '🛍️ Que tal fazer seu primeiro pedido?',
                        value: 'Use o painel principal para abrir seu carrinho e começar a comprar!',
                        inline: false
                    }
                ])
                .setColor('#57f287')
                .setThumbnail('https://cdn.discordapp.com/attachments/123/456/gift.png') // Placeholder
                .setFooter({ text: 'Sistema PawStore - Notificação de Elegibilidade' })
                .setTimestamp();

            await user.send({ embeds: [embed] });

            console.log(`[FriendshipNotification] ✅ Notification sent to ${friendship.username} for account ${friendship.account_nickname}`);
            return true;

        } catch (error) {
            // ⭐ TRATAMENTO MELHOR DOS ERROS
            if (error.code === 50007) {
                console.log(`[FriendshipNotification] ⚠️ Cannot send DM to ${friendship.username} (DMs disabled)`);
            } else {
                console.error(`[FriendshipNotification] ❌ Failed to send notification to ${friendship.discord_id}:`, error.message);
            }
            return false;
        }
    }

    // Marcar amizade como notificada
    async markAsNotified(friendshipId) {
        try {
            const query = 'UPDATE friendships SET notified_7_days = CURRENT_TIMESTAMP WHERE id = ?';
            const result = await db.run(query, [friendshipId]);

            if (result.changes > 0) {
                console.log(`[FriendshipNotification] ✅ Marked friendship ${friendshipId} as notified`);
                return true;
            } else {
                console.log(`[FriendshipNotification] ⚠️ No rows updated for friendship ${friendshipId}`);
                return false;
            }

        } catch (error) {
            console.error(`[FriendshipNotification] ❌ Error marking friendship ${friendshipId} as notified:`, error);
            return false;
        }
    }

    // Função auxiliar para sleep
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Verificar uma amizade específica (para testes)
    async checkSpecificFriendship(friendshipId) {
        try {
            const query = `
                SELECT 
                    f.*,
                    u.discord_id,
                    u.username,
                    a.nickname as account_nickname,
                    julianday('now') - julianday(f.added_at) as days_since_added
                FROM friendships f
                JOIN users u ON f.user_id = u.id
                JOIN accounts a ON f.account_id = a.id
                WHERE f.id = ?
            `;

            const friendship = await db.get(query, [friendshipId]);

            if (!friendship) {
                console.log(`[FriendshipNotification] Friendship ${friendshipId} not found`);
                return false;
            }

            const minDays = config.orderSettings?.minFriendshipDays || 7;
            const daysSince = friendship.days_since_added;

            console.log(`[FriendshipNotification] Friendship ${friendshipId}: ${daysSince.toFixed(2)} days since added (minimum: ${minDays})`);

            if (daysSince >= minDays && (!friendship.notified_7_days || friendship.notified_7_days === '')) {
                console.log(`[FriendshipNotification] Sending notification for friendship ${friendshipId}`);
                const success = await this.sendEligibilityNotification(friendship);
                
                if (success) {
                    await this.markAsNotified(friendshipId);
                    return true;
                }
            } else if (friendship.notified_7_days) {
                console.log(`[FriendshipNotification] Friendship ${friendshipId} already notified on ${friendship.notified_7_days}`);
            } else {
                console.log(`[FriendshipNotification] Friendship ${friendshipId} not yet eligible (${daysSince.toFixed(2)}/${minDays} days)`);
            }

            return false;

        } catch (error) {
            console.error(`[FriendshipNotification] Error checking specific friendship ${friendshipId}:`, error);
            return false;
        }
    }

    // Resetar notificações (para testes - USAR COM CUIDADO)
    async resetNotifications() {
        try {
            console.log('[FriendshipNotification] ⚠️ Resetting all friendship notifications...');
            
            const result = await db.run('UPDATE friendships SET notified_7_days = NULL');
            console.log(`[FriendshipNotification] ✅ Reset ${result.changes} notifications`);
            
            return result.changes;

        } catch (error) {
            console.error('[FriendshipNotification] ❌ Error resetting notifications:', error);
            throw error;
        }
    }

    // ⭐ MÉTODO ADICIONAL: Resetar notificação específica
    async resetSpecificNotification(friendshipId) {
        try {
            const result = await db.run('UPDATE friendships SET notified_7_days = NULL WHERE id = ?', [friendshipId]);
            
            if (result.changes > 0) {
                console.log(`[FriendshipNotification] ✅ Reset notification for friendship ${friendshipId}`);
                return true;
            } else {
                console.log(`[FriendshipNotification] ⚠️ Friendship ${friendshipId} not found or already reset`);
                return false;
            }

        } catch (error) {
            console.error(`[FriendshipNotification] ❌ Error resetting notification for friendship ${friendshipId}:`, error);
            return false;
        }
    }

    // Obter estatísticas do serviço
    async getStatistics() {
        try {
            const minDays = config.orderSettings?.minFriendshipDays || 7;

            // ⭐ USAR PARALLEL QUERIES PARA MELHOR PERFORMANCE
            const [totalResult, eligibleResult, notifiedResult, pendingResult] = await Promise.all([
                db.get('SELECT COUNT(*) as count FROM friendships'),
                db.get('SELECT COUNT(*) as count FROM friendships WHERE julianday(\'now\') - julianday(added_at) >= ?', [minDays]),
                db.get('SELECT COUNT(*) as count FROM friendships WHERE notified_7_days IS NOT NULL AND notified_7_days != \'\''),
                db.get('SELECT COUNT(*) as count FROM friendships WHERE julianday(\'now\') - julianday(added_at) >= ? AND (notified_7_days IS NULL OR notified_7_days = \'\')', [minDays])
            ]);

            return {
                totalFriendships: totalResult.count,
                eligibleFriendships: eligibleResult.count,
                notifiedFriendships: notifiedResult.count,
                pendingNotifications: pendingResult.count,
                isRunning: this.isRunning,
                minDays: minDays,
                lastCheck: new Date().toISOString()
            };

        } catch (error) {
            console.error('[FriendshipNotification] Error getting statistics:', error);
            return null;
        }
    }

    // ⭐ MÉTODO ADICIONAL: Listar próximas notificações
    async getUpcomingNotifications(limit = 10) {
        try {
            const minDays = config.orderSettings?.minFriendshipDays || 7;
            
            const query = `
                SELECT 
                    f.*,
                    u.username,
                    a.nickname as account_nickname,
                    julianday('now') - julianday(f.added_at) as days_since_added,
                    ? - (julianday('now') - julianday(f.added_at)) as days_remaining
                FROM friendships f
                JOIN users u ON f.user_id = u.id
                JOIN accounts a ON f.account_id = a.id
                WHERE julianday('now') - julianday(f.added_at) < ?
                AND (f.notified_7_days IS NULL OR f.notified_7_days = '')
                ORDER BY f.added_at ASC
                LIMIT ?
            `;

            return await db.all(query, [minDays, minDays, limit]);

        } catch (error) {
            console.error('[FriendshipNotification] Error getting upcoming notifications:', error);
            return [];
        }
    }
}

module.exports = FriendshipNotificationService;