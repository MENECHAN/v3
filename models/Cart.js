const db = require('../database/connection');

class Cart {
    static async findById(id) {
        try {
            console.log(`[DEBUG Cart.findById] Searching for cart ID: ${id}`);
            const query = 'SELECT * FROM carts WHERE id = ?';
            const cart = await db.get(query, [id]);
            console.log(`[DEBUG Cart.findById] Cart found:`, cart ? `Status: ${cart.status}` : 'Not found');
            return cart;
        } catch (error) {
            console.error('Error finding cart by ID:', error);
            throw error;
        }
    }

    static async findActiveByUserId(userId) {
        try {
            console.log(`[DEBUG Cart.findActiveByUserId] Searching for user: ${userId}`);

            // ⭐ CORREÇÃO: Buscar primeiro diretamente por Discord ID como string
            let query = 'SELECT * FROM carts WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1';
            let cart = await db.get(query, [userId.toString(), 'active']);

            if (cart) {
                console.log(`[DEBUG Cart.findActiveByUserId] Found active cart directly: ${cart.id}`);
                return cart;
            }

            // ⭐ CORREÇÃO: Buscar através da tabela users se não encontrou diretamente
            query = `
            SELECT c.* FROM carts c
            JOIN users u ON c.user_id = u.discord_id
            WHERE u.discord_id = ? AND c.status = ?
            ORDER BY c.created_at DESC LIMIT 1
        `;
            cart = await db.get(query, [userId.toString(), 'active']);

            console.log(`[DEBUG Cart.findActiveByUserId] Final result:`, cart ? `Cart ID ${cart.id}` : 'No active cart found');
            return cart;

        } catch (error) {
            console.error('Error finding active cart:', error);
            throw error;
        }
    }

    static async findByChannelId(channelId) {
        try {
            const query = 'SELECT * FROM carts WHERE ticket_channel_id = ?';
            return await db.get(query, [channelId]);
        } catch (error) {
            console.error('Error finding cart by channel ID:', error);
            throw error;
        }
    }

    static async create(userId, channelId, region = null) {
        try {
            console.log(`[DEBUG Cart.create] Creating cart for user: ${userId}, channel: ${channelId}, region: ${region}`);

            // Update the SQL query to include the region column
            const query = `
            INSERT INTO carts (user_id, ticket_channel_id, status, total_rp, total_price, region, created_at) 
            VALUES (?, ?, 'active', 0, 0.00, ?, CURRENT_TIMESTAMP)
        `;

            const result = await db.run(query, [userId, channelId, region]);
            console.log(`[DEBUG Cart.create] Cart created with ID: ${result.lastID}`);

            const newCart = await this.findById(result.lastID);
            console.log(`[DEBUG Cart.create] Retrieved new cart:`, newCart);

            return newCart;
        } catch (error) {
            console.error('Error creating cart:', error);
            throw error;
        }
    }

    static async updateStatus(id, status) {
        try {
            const query = 'UPDATE carts SET status = ? WHERE id = ?';
            const result = await db.run(query, [status, id]);
            return result.changes > 0;
        } catch (error) {
            console.error('Error updating cart status:', error);
            throw error;
        }
    }

    static async getAccountsByCartRegion(cartId) {
        try {
            const cart = await this.findById(cartId);
            if (!cart || !cart.region) {
                // If no region specified, return all available accounts
                return await Account.findAvailable();
            }

            // Get all available accounts
            const allAccounts = await Account.findAvailable();

            // Filter accounts by the cart's region
            return allAccounts.filter(account => account.region === cart.region);
        } catch (error) {
            console.error('Error getting accounts by cart region:', error);
            throw error;
        }
    }

    static async updateTotals(cartId, totalRP = null, totalPrice = null) {
        try {
            // If totals not provided, calculate them
            if (totalRP === null || totalPrice === null) {
                const items = await this.getItems(cartId);
                totalRP = items.reduce((sum, item) => sum + item.skin_price, 0);
                totalPrice = totalRP * 0.01;
            }

            // ⭐ CORREÇÃO: Verificar se a coluna updated_at existe
            try {
                // Tentar com updated_at primeiro
                const query = 'UPDATE carts SET total_rp = ?, total_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
                const result = await db.run(query, [totalRP, totalPrice, cartId]);
                return result.changes > 0;
            } catch (updateError) {
                // Se falhar (coluna não existe), tentar sem updated_at
                console.log(`[DEBUG Cart.updateTotals] Trying without updated_at for cart ${cartId}`);
                const query = 'UPDATE carts SET total_rp = ?, total_price = ? WHERE id = ?';
                const result = await db.run(query, [totalRP, totalPrice, cartId]);
                return result.changes > 0;
            }
        } catch (error) {
            console.error('Error updating cart totals:', error);
            throw error;
        }
    }

    static async delete(id) {
        try {
            // Delete cart items first
            await db.run('DELETE FROM cart_items WHERE cart_id = ?', [id]);

            // Then delete cart
            const query = 'DELETE FROM carts WHERE id = ?';
            const result = await db.run(query, [id]);
            return result.changes > 0;
        } catch (error) {
            console.error('Error deleting cart:', error);
            throw error;
        }
    }

    static async addItem(cartId, skinName, skinPrice, skinImageUrl = null, category = null, originalItemId = null) {
        try {
            const query = `
            INSERT INTO cart_items (cart_id, skin_name, skin_price, skin_image_url, category, original_item_id, added_at) 
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
            const result = await db.run(query, [cartId, skinName, skinPrice, skinImageUrl, category, originalItemId]);

            // Update cart totals
            await this.updateTotals(cartId);

            return result.lastID;
        } catch (error) {
            console.error('Error adding item to cart:', error);
            throw error;
        }
    }

    static async removeItem(itemId) {
        try {
            // Get cart ID before deleting
            const item = await db.get('SELECT cart_id FROM cart_items WHERE id = ?', [itemId]);

            if (!item) {
                return false;
            }

            const query = 'DELETE FROM cart_items WHERE id = ?';
            const result = await db.run(query, [itemId]);

            if (result.changes > 0) {
                // Update cart totals
                await this.updateTotals(item.cart_id);
                return true;
            }

            return false;
        } catch (error) {
            console.error('Error removing item from cart:', error);
            throw error;
        }
    }

    static async getItems(cartId) {
        try {
            const query = 'SELECT * FROM cart_items WHERE cart_id = ? ORDER BY added_at ASC';
            return await db.all(query, [cartId]);
        } catch (error) {
            console.error('Error getting cart items:', error);
            throw error;
        }
    }

    static async clearItems(cartId) {
        try {
            const query = 'DELETE FROM cart_items WHERE cart_id = ?';
            const result = await db.run(query, [cartId]);

            // Update cart totals to 0
            await this.updateTotals(cartId, 0, 0);

            return result.changes;
        } catch (error) {
            console.error('Error clearing cart items:', error);
            throw error;
        }
    }

    static async findByUserId(userId) {
        try {
            const query = 'SELECT * FROM carts WHERE user_id = ? ORDER BY created_at DESC';
            return await db.all(query, [userId]);
        } catch (error) {
            console.error('Error finding carts by user ID:', error);
            throw error;
        }
    }

    static async findByStatus(status) {
        try {
            const query = 'SELECT * FROM carts WHERE status = ? ORDER BY created_at DESC';
            return await db.all(query, [status]);
        } catch (error) {
            console.error('Error finding carts by status:', error);
            throw error;
        }
    }

    static async count() {
        try {
            const query = 'SELECT COUNT(*) as count FROM carts';
            const result = await db.get(query);
            return result.count;
        } catch (error) {
            console.error('Error counting carts:', error);
            throw error;
        }
    }

    static async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_carts,
                    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_carts,
                    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_carts,
                    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_carts,
                    SUM(total_price) as total_revenue,
                    AVG(total_price) as avg_order_value,
                    SUM(total_rp) as total_rp_sold
                FROM carts
            `;
            const result = await db.get(query);

            return {
                totalCarts: result.total_carts,
                activeCarts: result.active_carts || 0,
                completedCarts: result.completed_carts || 0,
                cancelledCarts: result.cancelled_carts || 0,
                totalRevenue: result.total_revenue || 0,
                averageOrderValue: result.avg_order_value || 0,
                totalRPSold: result.total_rp_sold || 0
            };
        } catch (error) {
            console.error('Error getting cart statistics:', error);
            throw error;
        }
    }

    static async getRecentOrders(limit = 10) {
        try {
            const query = `
                SELECT c.*, u.username, u.discord_id
                FROM carts c
                JOIN users u ON c.user_id = u.id
                WHERE c.status = 'completed'
                ORDER BY c.created_at DESC
                LIMIT ?
            `;
            return await db.all(query, [limit]);
        } catch (error) {
            console.error('Error getting recent orders:', error);
            throw error;
        }
    }

    static async getTopBuyers(limit = 10) {
        try {
            const query = `
                SELECT 
                    u.username,
                    u.discord_id,
                    COUNT(c.id) as order_count,
                    SUM(c.total_price) as total_spent
                FROM carts c
                JOIN users u ON c.user_id = u.id
                WHERE c.status = 'completed'
                GROUP BY u.id
                ORDER BY total_spent DESC
                LIMIT ?
            `;
            return await db.all(query, [limit]);
        } catch (error) {
            console.error('Error getting top buyers:', error);
            throw error;
        }
    }

    static async getOrdersByDateRange(startDate, endDate) {
        try {
            const query = `
                SELECT * FROM carts
                WHERE created_at BETWEEN ? AND ?
                ORDER BY created_at DESC
            `;
            return await db.all(query, [startDate, endDate]);
        } catch (error) {
            console.error('Error getting orders by date range:', error);
            throw error;
        }
    }

    // Métodos específicos para categorias
    static async getItemsByCategory(cartId) {
        try {
            const query = `
                SELECT category, COUNT(*) as count, SUM(skin_price) as total_price
                FROM cart_items 
                WHERE cart_id = ? 
                GROUP BY category
                ORDER BY count DESC
            `;
            return await db.all(query, [cartId]);
        } catch (error) {
            console.error('Error getting items by category:', error);
            throw error;
        }
    }

    static async findItemInCart(cartId, originalItemId) {
        try {
            const query = 'SELECT * FROM cart_items WHERE cart_id = ? AND original_item_id = ? LIMIT 1';
            return await db.get(query, [cartId, originalItemId]);
        } catch (error) {
            console.error('Error finding item in cart:', error);
            throw error;
        }
    }

    static async validateCartLimits(cartId, config = null) {
        try {
            const items = await this.getItems(cartId);
            const validation = {
                valid: true,
                errors: []
            };

            if (config && config.orderSettings) {
                // Verificar limite máximo de itens
                if (config.orderSettings.maxItemsPerOrder && items.length >= config.orderSettings.maxItemsPerOrder) {
                    validation.valid = false;
                    validation.errors.push(`Limite máximo de ${config.orderSettings.maxItemsPerOrder} itens por carrinho`);
                }

                // Verificar limite de valor total se existir
                if (config.orderSettings.maxOrderValue) {
                    const totalPrice = items.reduce((sum, item) => sum + (item.skin_price * 0.01), 0);
                    if (totalPrice > config.orderSettings.maxOrderValue) {
                        validation.valid = false;
                        validation.errors.push(`Valor máximo por pedido excedido: €${totalPrice.toFixed(2)} > €${config.orderSettings.maxOrderValue}`);
                    }
                }
            }

            return validation;
        } catch (error) {
            console.error('Error validating cart limits:', error);
            return { valid: false, errors: ['Erro ao validar limites do carrinho'] };
        }
    }

    static async getCategoryStatistics(cartId = null) {
        try {
            let query = `
                SELECT 
                    category,
                    COUNT(*) as item_count,
                    SUM(skin_price) as total_rp,
                    AVG(skin_price) as avg_price
                FROM cart_items
            `;

            const params = [];
            if (cartId) {
                query += ' WHERE cart_id = ?';
                params.push(cartId);
            }

            query += ' GROUP BY category ORDER BY item_count DESC';

            return await db.all(query, params);
        } catch (error) {
            console.error('Error getting category statistics:', error);
            throw error;
        }
    }
}

module.exports = Cart;