// services/clientMessageManager.js - Gerenciador completo de mensagens do cliente

const { EmbedBuilder, ActionRowBuilder } = require('discord.js');

class ClientMessageManager {
    constructor() {
        // Cache para rastrear a última mensagem do bot em cada canal
        this.lastBotMessages = new Map(); // channelId -> messageId
        this.messageTimestamps = new Map(); // messageId -> timestamp
        this.channelContexts = new Map(); // channelId -> context (cart, order, etc)
        
        // Configurações
        this.maxMessageAge = 60 * 60 * 1000; // 1 hora
        this.cleanupInterval = 30 * 60 * 1000; // Limpar cache a cada 30 minutos
        
        // Iniciar limpeza automática
        this.startPeriodicCleanup();
        
        console.log('[ClientMessageManager] Initialized');
    }

    /**
     * Envia ou edita uma mensagem para o cliente
     * Regra principal: Uma embed por canal que sempre é editada
     * @param {TextChannel} channel - Canal onde enviar/editar
     * @param {Object} messageData - Dados da mensagem (embeds, components, content)
     * @param {string} context - Contexto da mensagem (opcional: cart, checkout, order)
     * @param {boolean} forceNew - Forçar nova mensagem
     */
    async sendOrEditClientMessage(channel, messageData, context = null, forceNew = false) {
        try {
            const channelId = channel.id;
            
            console.log(`[ClientMessageManager] Processing message for channel ${channelId}, context: ${context}, forceNew: ${forceNew}`);
            
            // Se forceNew é true, criar nova mensagem
            if (forceNew) {
                return await this.createNewMessage(channel, messageData, context);
            }

            // Tentar editar mensagem existente
            const editResult = await this.tryEditExistingMessage(channel, messageData, context);
            if (editResult) {
                return editResult;
            }

            // Se não conseguiu editar, criar nova
            return await this.createNewMessage(channel, messageData, context);

        } catch (error) {
            console.error('[ClientMessageManager] Error in sendOrEditClientMessage:', error);
            throw error;
        }
    }

    /**
     * Tenta editar a mensagem existente do bot no canal
     */
    async tryEditExistingMessage(channel, messageData, context) {
        try {
            const channelId = channel.id;
            const lastMessageId = this.lastBotMessages.get(channelId);

            if (!lastMessageId) {
                console.log(`[ClientMessageManager] No previous message found for channel ${channelId}`);
                return null;
            }

            // Tentar buscar a mensagem
            let lastMessage;
            try {
                lastMessage = await channel.messages.fetch(lastMessageId);
            } catch (fetchError) {
                console.log(`[ClientMessageManager] Could not fetch message ${lastMessageId}: ${fetchError.message}`);
                this.removeFromCache(channelId);
                return null;
            }

            // Verificar se a mensagem é válida para edição
            if (!this.isValidForEdit(lastMessage)) {
                console.log(`[ClientMessageManager] Message ${lastMessageId} is not valid for editing`);
                this.removeFromCache(channelId);
                return null;
            }

            // Editar a mensagem
            await lastMessage.edit(messageData);
            this.updateTimestamp(lastMessageId);
            
            // Atualizar contexto se fornecido
            if (context) {
                this.channelContexts.set(channelId, context);
            }

            console.log(`[ClientMessageManager] Successfully edited message ${lastMessageId} in channel ${channelId}`);
            return lastMessage;

        } catch (error) {
            console.error('[ClientMessageManager] Error trying to edit message:', error);
            return null;
        }
    }

    /**
     * Cria uma nova mensagem no canal
     */
    async createNewMessage(channel, messageData, context) {
        try {
            const channelId = channel.id;

            // Limpar mensagens antigas primeiro
            await this.cleanupOldMessages(channel);

            // Enviar nova mensagem
            const newMessage = await channel.send(messageData);
            
            // Atualizar cache
            this.lastBotMessages.set(channelId, newMessage.id);
            this.updateTimestamp(newMessage.id);
            
            if (context) {
                this.channelContexts.set(channelId, context);
            }

            console.log(`[ClientMessageManager] Created new message ${newMessage.id} in channel ${channelId}`);
            return newMessage;

        } catch (error) {
            console.error('[ClientMessageManager] Error creating new message:', error);
            throw error;
        }
    }

    /**
     * Envia resposta ephemeral para interactions
     * @param {Interaction} interaction - A interaction do Discord
     * @param {Object} messageData - Dados da mensagem
     */
    async sendEphemeralResponse(interaction, messageData) {
        try {
            const ephemeralData = { ...messageData, ephemeral: true };

            if (interaction.deferred) {
                return await interaction.editReply(ephemeralData);
            } else if (interaction.replied) {
                return await interaction.followUp(ephemeralData);
            } else {
                return await interaction.reply(ephemeralData);
            }
        } catch (error) {
            console.error('[ClientMessageManager] Error sending ephemeral response:', error);
            
            // Fallback: tentar followUp se reply falhou
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.deferReply({ ephemeral: true });
                }
                return await interaction.followUp({ ...messageData, ephemeral: true });
            } catch (fallbackError) {
                console.error('[ClientMessageManager] Fallback also failed:', fallbackError);
                throw error;
            }
        }
    }

    /**
     * Força uma nova mensagem (para casos especiais como checkout)
     * @param {TextChannel} channel - Canal
     * @param {Object} messageData - Dados da mensagem
     * @param {string} context - Contexto
     */
    async forceNewMessage(channel, messageData, context = null) {
        return await this.sendOrEditClientMessage(channel, messageData, context, true);
    }

    /**
     * Verifica se uma mensagem é válida para edição
     * @param {Message} message - A mensagem
     */
    isValidForEdit(message) {
        if (!message || message.author.id !== message.client.user.id) {
            return false;
        }

        // Verificar se a mensagem tem embeds (só editamos messages com embeds)
        if (!message.embeds || message.embeds.length === 0) {
            return false;
        }

        // Verificar se a mensagem é recente
        const messageAge = Date.now() - message.createdTimestamp;
        if (messageAge > this.maxMessageAge) {
            return false;
        }

        return true;
    }

    /**
     * Atualiza timestamp de uma mensagem no cache
     * @param {string} messageId - ID da mensagem
     */
    updateTimestamp(messageId) {
        this.messageTimestamps.set(messageId, Date.now());
    }

    /**
     * Remove uma entrada do cache
     * @param {string} channelId - ID do canal
     */
    removeFromCache(channelId) {
        const messageId = this.lastBotMessages.get(channelId);
        if (messageId) {
            this.messageTimestamps.delete(messageId);
        }
        this.lastBotMessages.delete(channelId);
        this.channelContexts.delete(channelId);
        
        console.log(`[ClientMessageManager] Removed cache for channel ${channelId}`);
    }

    /**
     * Limpa mensagens antigas do cache e opcionalmente do canal
     * @param {TextChannel} channel - Canal (opcional)
     * @param {boolean} deleteFromChannel - Se deve deletar do canal também
     */
    async cleanupOldMessages(channel = null, deleteFromChannel = true) {
        try {
            if (!channel || !deleteFromChannel) return;

            const messages = await channel.messages.fetch({ limit: 10 });
            const botMessages = messages.filter(msg => 
                msg.author.id === channel.client.user.id && 
                msg.embeds.length > 0
            );

            // Se há mais de 1 mensagem do bot com embeds, deletar as antigas
            if (botMessages.size > 1) {
                const sortedMessages = Array.from(botMessages.values())
                    .sort((a, b) => b.createdTimestamp - a.createdTimestamp);

                // Manter apenas a mais recente, deletar as outras
                for (let i = 1; i < sortedMessages.length; i++) {
                    try {
                        await sortedMessages[i].delete();
                        console.log(`[ClientMessageManager] Deleted old message ${sortedMessages[i].id} from channel ${channel.id}`);
                    } catch (deleteError) {
                        console.warn(`[ClientMessageManager] Could not delete message: ${deleteError.message}`);
                    }
                }
            }
        } catch (error) {
            console.error('[ClientMessageManager] Error in cleanupOldMessages:', error);
        }
    }

    /**
     * Limpa cache antigo periodicamente
     */
    cleanupCache() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [messageId, timestamp] of this.messageTimestamps.entries()) {
            if (now - timestamp > this.maxMessageAge) {
                this.messageTimestamps.delete(messageId);
                cleanedCount++;
                
                // Remover da cache principal também
                for (const [channelId, cachedMessageId] of this.lastBotMessages.entries()) {
                    if (cachedMessageId === messageId) {
                        this.lastBotMessages.delete(channelId);
                        this.channelContexts.delete(channelId);
                        break;
                    }
                }
            }
        }

        if (cleanedCount > 0) {
            console.log(`[ClientMessageManager] Cleaned ${cleanedCount} old entries from cache`);
        }
    }

    /**
     * Inicia limpeza periódica do cache
     */
    startPeriodicCleanup() {
        setInterval(() => {
            this.cleanupCache();
        }, this.cleanupInterval);
        
        console.log(`[ClientMessageManager] Started periodic cleanup every ${this.cleanupInterval / 1000}s`);
    }

    /**
     * Obtém estatísticas do gerenciador
     */
    getStats() {
        return {
            totalChannels: this.lastBotMessages.size,
            totalMessages: this.messageTimestamps.size,
            contexts: Array.from(this.channelContexts.values()).reduce((acc, context) => {
                acc[context] = (acc[context] || 0) + 1;
                return acc;
            }, {}),
            oldestMessage: this.messageTimestamps.size > 0 ? 
                Math.min(...this.messageTimestamps.values()) : null,
            newestMessage: this.messageTimestamps.size > 0 ? 
                Math.max(...this.messageTimestamps.values()) : null
        };
    }

    /**
     * Método específico para carrinho - sempre edita
     */
    async updateCartMessage(channel, cartEmbed, components, cartId) {
        return await this.sendOrEditClientMessage(channel, {
            embeds: [cartEmbed],
            components: components
        }, `cart_${cartId}`);
    }

    /**
     * Método específico para checkout - força nova mensagem
     */
    async sendCheckoutMessage(channel, checkoutEmbed, components, cartId) {
        return await this.forceNewMessage(channel, {
            embeds: [checkoutEmbed],
            components: components
        }, `checkout_${cartId}`);
    }

    /**
     * Método específico para categoria - edita ou nova
     */
    async updateCategoryMessage(channel, categoryEmbed, components, cartId) {
        return await this.sendOrEditClientMessage(channel, {
            embeds: [categoryEmbed],
            components: components
        }, `category_${cartId}`);
    }

    /**
     * Método específico para itens - edita ou nova
     */
    async updateItemsMessage(channel, itemsEmbed, components, cartId, category) {
        return await this.sendOrEditClientMessage(channel, {
            embeds: [itemsEmbed],
            components: components
        }, `items_${cartId}_${category}`);
    }

    /**
     * Método específico para preview de item - edita ou nova
     */
    async updateItemPreviewMessage(channel, previewEmbed, components, cartId, itemId) {
        return await this.sendOrEditClientMessage(channel, {
            embeds: [previewEmbed],
            components: components
        }, `preview_${cartId}_${itemId}`);
    }

    /**
     * Método específico para pesquisa - edita ou nova
     */
    async updateSearchMessage(channel, searchEmbed, components, cartId, searchQuery) {
        return await this.sendOrEditClientMessage(channel, {
            embeds: [searchEmbed],
            components: components
        }, `search_${cartId}_${searchQuery}`);
    }

    /**
     * Método específico para confirmação de pedido - edita ou nova
     */
    async updateOrderConfirmationMessage(channel, orderEmbed, components, orderId) {
        return await this.sendOrEditClientMessage(channel, {
            embeds: [orderEmbed],
            components: components
        }, `order_${orderId}`);
    }

    /**
     * Método para enviar mensagem de erro como ephemeral
     */
    async sendErrorResponse(interaction, errorTitle, errorDescription) {
        const errorEmbed = new EmbedBuilder()
            .setTitle(`❌ ${errorTitle}`)
            .setDescription(errorDescription)
            .setColor('#ed4245')
            .setTimestamp();

        return await this.sendEphemeralResponse(interaction, {
            embeds: [errorEmbed]
        });
    }

    /**
     * Método para enviar mensagem de sucesso como ephemeral
     */
    async sendSuccessResponse(interaction, successTitle, successDescription) {
        const successEmbed = new EmbedBuilder()
            .setTitle(`✅ ${successTitle}`)
            .setDescription(successDescription)
            .setColor('#57f287')
            .setTimestamp();

        return await this.sendEphemeralResponse(interaction, {
            embeds: [successEmbed]
        });
    }

    /**
     * Método para enviar mensagem de aviso como ephemeral
     */
    async sendWarningResponse(interaction, warningTitle, warningDescription) {
        const warningEmbed = new EmbedBuilder()
            .setTitle(`⚠️ ${warningTitle}`)
            .setDescription(warningDescription)
            .setColor('#faa61a')
            .setTimestamp();

        return await this.sendEphemeralResponse(interaction, {
            embeds: [warningEmbed]
        });
    }

    /**
     * Método para debug - mostra informações do cache
     */
    debug() {
        console.log('[ClientMessageManager] Debug Info:');
        console.log('Channels tracked:', this.lastBotMessages.size);
        console.log('Messages tracked:', this.messageTimestamps.size);
        console.log('Contexts:', Object.entries(this.getStats().contexts));
        
        // Mostrar alguns exemplos
        let count = 0;
        for (const [channelId, messageId] of this.lastBotMessages.entries()) {
            if (count < 5) {
                const context = this.channelContexts.get(channelId);
                const timestamp = this.messageTimestamps.get(messageId);
                const age = timestamp ? Math.floor((Date.now() - timestamp) / 1000) : 'unknown';
                console.log(`  Channel ${channelId}: Message ${messageId}, Context: ${context}, Age: ${age}s`);
                count++;
            }
        }
    }
}

// Criar instância singleton
const clientMessageManager = new ClientMessageManager();

// Export do singleton
module.exports = clientMessageManager;

// Export da classe também (para testes)
module.exports.ClientMessageManager = ClientMessageManager;