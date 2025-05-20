const db = require('../database/connection');

class User {
    static async findById(id) {
        try {
            const query = 'SELECT * FROM users WHERE id = ?';
            return await db.get(query, [id]);
        } catch (error) {
            console.error('Error finding user by ID:', error);
            throw error;
        }
    }

    static async findByDiscordId(discordId) {
        try {
            const query = 'SELECT * FROM users WHERE discord_id = ?';
            return await db.get(query, [discordId]);
        } catch (error) {
            console.error('Error finding user by Discord ID:', error);
            throw error;
        }
    }

    static async create(discordId, username) {
        try {
            const query = 'INSERT INTO users (discord_id, username) VALUES (?, ?)';
            const result = await db.run(query, [discordId, username]);
            return result.lastID;
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    static async findOrCreate(discordId, username) {
        try {
            let user = await this.findByDiscordId(discordId);
            
            if (!user) {
                const userId = await this.create(discordId, username);
                user = await this.findById(userId);
            } else {
                // Update username if different
                if (user.username !== username) {
                    await this.updateUsername(user.id, username);
                    user.username = username;
                }
            }
            
            return user;
        } catch (error) {
            console.error('Error in findOrCreate:', error);
            throw error;
        }
    }

    static async updateUsername(id, username) {
        try {
            const query = 'UPDATE users SET username = ? WHERE id = ?';
            await db.run(query, [username, id]);
        } catch (error) {
            console.error('Error updating username:', error);
            throw error;
        }
    }

    static async findAll() {
        try {
            const query = 'SELECT * FROM users ORDER BY created_at DESC';
            return await db.all(query);
        } catch (error) {
            console.error('Error finding all users:', error);
            throw error;
        }
    }

    static async delete(id) {
        try {
            const query = 'DELETE FROM users WHERE id = ?';
            const result = await db.run(query, [id]);
            return result.changes > 0;
        } catch (error) {
            console.error('Error deleting user:', error);
            throw error;
        }
    }

    static async count() {
        try {
            const query = 'SELECT COUNT(*) as count FROM users';
            const result = await db.get(query);
            return result.count;
        } catch (error) {
            console.error('Error counting users:', error);
            throw error;
        }
    }

    static async getStatistics() {
        try {
            const totalUsers = await this.count();
            const query = `
                SELECT 
                    COUNT(DISTINCT u.id) as active_users,
                    COUNT(c.id) as total_carts,
                    SUM(CASE WHEN c.status = 'completed' THEN 1 ELSE 0 END) as completed_orders
                FROM users u
                LEFT JOIN carts c ON u.id = c.user_id
            `;
            const result = await db.get(query);
            
            return {
                totalUsers,
                activeUsers: result.active_users,
                totalCarts: result.total_carts,
                completedOrders: result.completed_orders
            };
        } catch (error) {
            console.error('Error getting user statistics:', error);
            throw error;
        }
    }
}

module.exports = User;