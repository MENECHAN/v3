const { MessageManager, Channel, Message, EmbedBuilder } = require('discord.js');

class ClientMessageManager {
    constructor() {
        // Cache to track the last bot message in each channel
        this.lastBotMessages = new Map(); // channelId -> messageId
        this.messageTimestamps = new Map(); // messageId -> timestamp
        this.channelContexts = new Map(); // channelId -> context (cart, order, etc)
        
        // Configuration
        this.maxMessageAge = 60 * 60 * 1000; // 1 hour
        this.cleanupInterval = 30 * 60 * 1000; // Clean cache every 30 minutes
        
        // Start automatic cleanup
        this.startPeriodicCleanup();
        
        console.log('[ClientMessageManager] Initialized');
    }

    /**
     * Sends or edits a message to the client
     * Main rule: One embed per channel that is always edited
     * @param {Channel} channel - Channel to send/edit
     * @param {Object} messageData - Message data (embeds, components, content)
     * @param {string} context - Message context (optional: cart, checkout, order)
     * @param {boolean} forceNew - Force new message
     */
    async sendOrEditClientMessage(channel, messageData, context = null, forceNew = false) {
        try {
            const channelId = channel.id;
            
            console.log(`[ClientMessageManager] Processing message for channel ${channelId}, context: ${context}, forceNew: ${forceNew}`);
            
            // If forceNew is true, create new message
            if (forceNew) {
                return await this.createNewMessage(channel, messageData, context);
            }

            // Try to edit existing message
            const editResult = await this.tryEditExistingMessage(channel, messageData, context);
            if (editResult) {
                return editResult;
            }

            // If edit failed, create new
            return await this.createNewMessage(channel, messageData, context);

        } catch (error) {
            console.error('[ClientMessageManager] Error in sendOrEditClientMessage:', error);
            throw error;
        }
    }

    /**
     * Tries to edit the existing bot message in the channel
     */
    async tryEditExistingMessage(channel, messageData, context) {
        try {
            const channelId = channel.id;
            const lastMessageId = this.lastBotMessages.get(channelId);

            if (!lastMessageId) {
                console.log(`[ClientMessageManager] No previous message found for channel ${channelId}`);
                return null;
            }

            // Try to fetch the message
            let lastMessage;
            try {
                lastMessage = await channel.messages.fetch(lastMessageId);
            } catch (fetchError) {
                console.log(`[ClientMessageManager] Could not fetch message ${lastMessageId}: ${fetchError.message}`);
                this.removeFromCache(channelId);
                return null;
            }

            // Check if message is valid for editing
            if (!this.isValidForEdit(lastMessage)) {
                console.log(`[ClientMessageManager] Message ${lastMessageId} is not valid for editing`);
                this.removeFromCache(channelId);
                return null;
            }

            // Edit the message
            await lastMessage.edit(messageData);
            this.updateTimestamp(lastMessageId);
            
            // Update context if provided
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
     * Creates a new message in the channel
     */
    async createNewMessage(channel, messageData, context) {
        try {
            const channelId = channel.id;

            // Clean up old messages first
            await this.cleanupOldMessages(channel);

            // Send new message
            const newMessage = await channel.send(messageData);
            
            // Update cache
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
     * Checks if a message is valid for editing
     * @param {Message} message - The message
     */
    isValidForEdit(message) {
        if (!message || message.author.id !== message.client.user.id) {
            return false;
        }

        // Check if message has embeds (we only edit messages with embeds)
        if (!message.embeds || message.embeds.length === 0) {
            return false;
        }

        // Check if message is recent
        const messageAge = Date.now() - message.createdTimestamp;
        if (messageAge > this.maxMessageAge) {
            return false;
        }

        return true;
    }

    /**
     * Updates timestamp of a message in cache
     * @param {string} messageId - Message ID
     */
    updateTimestamp(messageId) {
        this.messageTimestamps.set(messageId, Date.now());
    }

    /**
     * Removes an entry from cache
     * @param {string} channelId - Channel ID
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
     * Cleans up old messages from cache and optionally from channel
     * @param {Channel} channel - Channel (optional)
     * @param {boolean} deleteFromChannel - Whether to delete from channel too
     */
    async cleanupOldMessages(channel = null, deleteFromChannel = true) {
        try {
            if (!channel || !deleteFromChannel) return;

            const messages = await channel.messages.fetch({ limit: 10 });
            const botMessages = messages.filter(msg => 
                msg.author.id === channel.client.user.id && 
                msg.embeds.length > 0
            );

            // If there are more than 1 bot message with embeds, delete the old ones
            if (botMessages.size > 1) {
                const sortedMessages = Array.from(botMessages.values())
                    .sort((a, b) => b.createdTimestamp - a.createdTimestamp);

                // Keep only the most recent one, delete the others
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
     * Cleans up old cache periodically
     */
    cleanupCache() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [messageId, timestamp] of this.messageTimestamps.entries()) {
            if (now - timestamp > this.maxMessageAge) {
                this.messageTimestamps.delete(messageId);
                cleanedCount++;
                
                // Remove from main cache as well
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
     * Starts periodic cache cleanup
     */
    startPeriodicCleanup() {
        setInterval(() => {
            this.cleanupCache();
        }, this.cleanupInterval);
        
        console.log(`[ClientMessageManager] Started periodic cleanup every ${this.cleanupInterval / 1000}s`);
    }

    /**
     * Force a new message (for special cases like checkout)
     * @param {Channel} channel - Channel
     * @param {Object} messageData - Message data
     * @param {string} context - Context
     */
    async forceNewMessage(channel, messageData, context = null) {
        return await this.sendOrEditClientMessage(channel, messageData, context, true);
    }

    /**
     * Cart-specific method - always edits
     */
    async updateCartMessage(channel, cartEmbed, components, cartId) {
        return await this.sendOrEditClientMessage(channel, {
            embeds: [cartEmbed],
            components: components
        }, `cart_${cartId}`);
    }

    /**
     * Checkout-specific method - forces new message
     */
    async updateCheckoutMessage(channel, checkoutEmbed, components, cartId) {
        return await this.forceNewMessage(channel, {
            embeds: [checkoutEmbed],
            components: components
        }, `checkout_${cartId}`);
    }

    /**
     * Category-specific method - edits or new
     */
    async updateCategoryMessage(channel, categoryEmbed, components, cartId) {
        return await this.sendOrEditClientMessage(channel, {
            embeds: [categoryEmbed],
            components: components
        }, `category_${cartId}`);
    }

    /**
     * Items-specific method - edits or new
     */
    async updateItemsMessage(channel, itemsEmbed, components, cartId, category) {
        return await this.sendOrEditClientMessage(channel, {
            embeds: [itemsEmbed],
            components: components
        }, `items_${cartId}_${category}`);
    }

    /**
     * Item preview-specific method - edits or new
     */
    async updateItemPreviewMessage(channel, previewEmbed, components, cartId, itemId) {
        return await this.sendOrEditClientMessage(channel, {
            embeds: [previewEmbed],
            components: components
        }, `preview_${cartId}_${itemId}`);
    }

    /**
     * Search-specific method - edits or new
     */
    async updateSearchMessage(channel, searchEmbed, components, cartId, searchQuery) {
        return await this.sendOrEditClientMessage(channel, {
            embeds: [searchEmbed],
            components: components
        }, `search_${cartId}_${searchQuery}`);
    }

    /**
     * Order confirmation-specific method - edits or new
     */
    async updateOrderConfirmationMessage(channel, orderEmbed, components, orderId) {
        return await this.sendOrEditClientMessage(channel, {
            embeds: [orderEmbed],
            components: components
        }, `order_${orderId}`);
    }
}

// Create singleton instance
const clientMessageManager = new ClientMessageManager();

// Export singleton
module.exports = clientMessageManager;

// Also export class (for testing)
module.exports.ClientMessageManager = ClientMessageManager;