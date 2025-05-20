const db = require('../database/connection');

class Account {
    static async findById(id) {
        try {
            const query = 'SELECT * FROM accounts WHERE id = ?';
            return await db.get(query, [id]);
        } catch (error) {
            console.error('Error finding account by ID:', error);
            throw error;
        }
    }

    static async updateBalance(id, newBalance) {
        try {
            const query = 'UPDATE accounts SET rp_amount = ? WHERE id = ?';
            const result = await db.run(query, [newBalance, id]);
            return result.changes > 0;
        } catch (error) {
            console.error('Error updating account balance:', error);
            throw error;
        }
    }

    static async findAll() {
        try {
            const query = 'SELECT * FROM accounts ORDER BY created_at DESC';
            return await db.all(query);
        } catch (error) {
            console.error('Error finding all accounts:', error);
            throw error;
        }
    }

    static async findAvailable(region = null) {
        try {
            if (region) {
                return await this.findAvailableByRegion(region);
            }

            const query = 'SELECT * FROM accounts WHERE friends_count < max_friends ORDER BY friends_count ASC';
            return await db.all(query);
        } catch (error) {
            console.error('Error finding available accounts:', error);
            throw error;
        }
    }

    static async create(nickname, rpAmount, friendsCount = 0, maxFriends = 250, region = 'BR') {
        try {
            const query = `
            INSERT INTO accounts (nickname, rp_amount, friends_count, max_friends, region) 
            VALUES (?, ?, ?, ?, ?)
        `;
            const result = await db.run(query, [nickname, rpAmount, friendsCount, maxFriends, region]);
            return result.lastID;
        } catch (error) {
            console.error('Error creating account:', error);
            throw error;
        }
    }

    static async update(id, updates) {
        try {
            const allowedFields = ['nickname', 'rp_amount', 'friends_count', 'max_friends', 'region'];
            const fields = Object.keys(updates).filter(key => allowedFields.includes(key));

            if (fields.length === 0) {
                throw new Error('No valid fields to update');
            }

            const setClause = fields.map(field => `${field} = ?`).join(', ');
            const values = fields.map(field => updates[field]);
            values.push(id);

            const query = `UPDATE accounts SET ${setClause} WHERE id = ?`;
            const result = await db.run(query, values);

            return result.changes > 0;
        } catch (error) {
            console.error('Error updating account:', error);
            throw error;
        }
    }

    static async findByRegion(region) {
        try {
            const query = 'SELECT * FROM accounts WHERE region = ? ORDER BY friends_count ASC';
            return await db.all(query, [region]);
        } catch (error) {
            console.error('Error finding accounts by region:', error);
            throw error;
        }
    }

    static async findAvailableByRegion(region) {
        try {
            const query = 'SELECT * FROM accounts WHERE region = ? AND friends_count < max_friends ORDER BY friends_count ASC';
            return await db.all(query, [region]);
        } catch (error) {
            console.error('Error finding available accounts by region:', error);
            throw error;
        }
    }

    static async delete(id) {
        try {
            // First check if account has any friendships
            const friendships = await db.get('SELECT COUNT(*) as count FROM friendships WHERE account_id = ?', [id]);

            if (friendships.count > 0) {
                throw new Error('Cannot delete account with existing friendships');
            }

            const query = 'DELETE FROM accounts WHERE id = ?';
            const result = await db.run(query, [id]);
            return result.changes > 0;
        } catch (error) {
            console.error('Error deleting account:', error);
            throw error;
        }
    }

    static async incrementFriendCount(id) {
        try {
            const query = 'UPDATE accounts SET friends_count = friends_count + 1 WHERE id = ?';
            const result = await db.run(query, [id]);
            return result.changes > 0;
        } catch (error) {
            console.error('Error incrementing friend count:', error);
            throw error;
        }
    }

    static async decrementFriendCount(id) {
        try {
            const query = 'UPDATE accounts SET friends_count = friends_count - 1 WHERE id = ? AND friends_count > 0';
            const result = await db.run(query, [id]);
            return result.changes > 0;
        } catch (error) {
            console.error('Error decrementing friend count:', error);
            throw error;
        }
    }

    static async updateRP(id, newAmount) {
        try {
            const query = 'UPDATE accounts SET rp_amount = ? WHERE id = ?';
            const result = await db.run(query, [newAmount, id]);
            return result.changes > 0;
        } catch (error) {
            console.error('Error updating RP amount:', error);
            throw error;
        }
    }

    static async addRP(id, amount) {
        try {
            const query = 'UPDATE accounts SET rp_amount = rp_amount + ? WHERE id = ?';
            const result = await db.run(query, [amount, id]);
            return result.changes > 0;
        } catch (error) {
            console.error('Error adding RP:', error);
            throw error;
        }
    }

    static async subtractRP(id, amount) {
        try {
            const query = 'UPDATE accounts SET rp_amount = rp_amount - ? WHERE id = ? AND rp_amount >= ?';
            const result = await db.run(query, [amount, id, amount]);
            return result.changes > 0;
        } catch (error) {
            console.error('Error subtracting RP:', error);
            throw error;
        }
    }

    static async findByNickname(nickname) {
        try {
            const query = 'SELECT * FROM accounts WHERE LOWER(nickname) = LOWER(?) ORDER BY created_at DESC';
            return await db.all(query, [nickname]);
        } catch (error) {
            console.error('Error finding accounts by nickname:', error);
            throw error;
        }
    }

    static async count() {
        try {
            const query = 'SELECT COUNT(*) as count FROM accounts';
            const result = await db.get(query);
            return result.count;
        } catch (error) {
            console.error('Error counting accounts:', error);
            throw error;
        }
    }

    static async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_accounts,
                    SUM(rp_amount) as total_rp,
                    SUM(friends_count) as total_friends,
                    AVG(friends_count) as avg_friends,
                    COUNT(CASE WHEN friends_count >= max_friends THEN 1 END) as full_accounts,
                    COUNT(CASE WHEN friends_count < max_friends THEN 1 END) as available_accounts
                FROM accounts
            `;
            const result = await db.get(query);

            return {
                totalAccounts: result.total_accounts,
                totalRP: result.total_rp || 0,
                totalFriends: result.total_friends || 0,
                averageFriends: result.avg_friends || 0,
                fullAccounts: result.full_accounts || 0,
                availableAccounts: result.available_accounts || 0
            };
        } catch (error) {
            console.error('Error getting account statistics:', error);
            throw error;
        }
    }

    static async getTopAccounts(limit = 10) {
        try {
            const query = `
                SELECT * FROM accounts 
                ORDER BY rp_amount DESC 
                LIMIT ?
            `;
            return await db.all(query, [limit]);
        } catch (error) {
            console.error('Error getting top accounts:', error);
            throw error;
        }
    }

    static async searchByNickname(searchTerm) {
        try {
            const query = `
                SELECT * FROM accounts 
                WHERE nickname LIKE ? 
                ORDER BY nickname ASC
            `;
            return await db.all(query, [`%${searchTerm}%`]);
        } catch (error) {
            console.error('Error searching accounts:', error);
            throw error;
        }
    }
}

module.exports = Account;