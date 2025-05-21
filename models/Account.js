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


    static async getAvailableRegions() {
        try {
            const query = 'SELECT DISTINCT region FROM accounts WHERE region IS NOT NULL ORDER BY region ASC';
            const result = await db.all(query);
            return result.map(row => row.region).filter(Boolean);
        } catch (error) {
            console.error('Error getting available regions:', error);
            return [];
        }
    }

    static async findByRegion(region) {
        try {
            const query = 'SELECT * FROM accounts WHERE region = ? ORDER BY nickname ASC';
            return await db.all(query, [region]);
        } catch (error) {
            console.error('Error finding accounts by region:', error);
            return [];
        }
    }


    static async findAvailableByRegion(region) {
        try {
            if (!region) {
                return this.findAvailable();
            }

            const query = 'SELECT * FROM accounts WHERE region = ? AND friends_count < max_friends ORDER BY friends_count ASC';
            return await db.all(query, [region]);
        } catch (error) {
            console.error('Error finding available accounts by region:', error);
            return [];
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

    static async updateRegion(accountId, region) {
        try {
            const query = 'UPDATE accounts SET region = ? WHERE id = ?';
            const result = await db.run(query, [region, accountId]);
            return result.changes > 0;
        } catch (error) {
            console.error('Error updating account region:', error);
            return false;
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

    static async getRegionStatistics() {
        try {
            const query = `
            SELECT 
                region, 
                COUNT(*) as total_accounts,
                SUM(friends_count) as total_friends,
                AVG(friends_count) as avg_friends,
                SUM(rp_amount) as total_rp
            FROM accounts 
            GROUP BY region
            ORDER BY region ASC
        `;

            const result = await db.all(query);

            // Processar resultados
            return result.map(row => ({
                region: row.region || 'Sem região',
                totalAccounts: row.total_accounts || 0,
                totalFriends: row.total_friends || 0,
                avgFriends: parseFloat(row.avg_friends || 0).toFixed(1),
                totalRP: row.total_rp || 0
            }));
        } catch (error) {
            console.error('Error getting region statistics:', error);
            return [];
        }
    }

    static async getStatistics() {
        try {
            const query = `
            SELECT 
                COUNT(*) as total_friendships,
                COUNT(DISTINCT f.user_id) as users_with_friends,
                COUNT(DISTINCT f.account_id) as accounts_with_friends,
                CASE 
                    WHEN COUNT(DISTINCT f.user_id) > 0 THEN 
                        CAST(COUNT(*) AS FLOAT) / COUNT(DISTINCT f.user_id)
                    ELSE 0
                END as avg_friends_per_user
            FROM friendships f
        `;
            const result = await db.get(query);

            return {
                totalFriendships: result.total_friendships || 0,
                usersWithFriends: result.users_with_friends || 0,
                accountsWithFriends: result.accounts_with_friends || 0,
                averageFriendsPerUser: result.avg_friends_per_user || 0
            };
        } catch (error) {
            console.error('Error getting friendship statistics:', error);
            // Retornar valores padrão em caso de erro
            return {
                totalFriendships: 0,
                usersWithFriends: 0,
                accountsWithFriends: 0,
                averageFriendsPerUser: 0
            };
        }
    }

    static async getTopAccounts(limit = 10) {
        try {
            // Query atualizada para obter dados completos e garantir valores não nulos
            const query = `
            SELECT 
                a.id,
                a.nickname,
                COUNT(f.id) as friend_count,
                COALESCE(a.max_friends, 250) as max_friends,
                ROUND((COUNT(f.id) * 100.0 / COALESCE(a.max_friends, 250)), 2) as fill_percentage
            FROM accounts a
            LEFT JOIN friendships f ON a.id = f.account_id
            GROUP BY a.id
            ORDER BY friend_count DESC
            LIMIT ?
        `;

            const accounts = await db.all(query, [limit]);

            // Garantir que todos os campos estejam definidos mesmo se vieram como null do banco
            return accounts.map(account => ({
                id: account.id,
                nickname: account.nickname || `Conta ${account.id}`,
                friend_count: account.friend_count || 0,
                max_friends: account.max_friends || 250,
                fill_percentage: account.fill_percentage || 0,
                region: account.region || 'BR'
            }));
        } catch (error) {
            console.error('Error getting top accounts by friends:', error);
            // Retornar array vazio em caso de erro para evitar quebras
            return [];
        }
    }

    static async getTopAccountsAlternative(limit = 10) {
        try {
            // Esta query usa subconsultas para obter contagens mais precisas
            const query = `
            WITH account_stats AS (
                SELECT 
                    a.id,
                    a.nickname,
                    a.max_friends,
                    a.region,
                    (SELECT COUNT(*) FROM friendships WHERE account_id = a.id) as friend_count
                FROM 
                    accounts a
            )
            SELECT 
                id,
                nickname,
                friend_count,
                COALESCE(max_friends, 250) as max_friends,
                CASE 
                    WHEN max_friends > 0 THEN ROUND((friend_count * 100.0 / max_friends), 2)
                    ELSE 0 
                END as fill_percentage,
                region
            FROM 
                account_stats
            ORDER BY 
                friend_count DESC
            LIMIT ?
        `;

            return await db.all(query, [limit]);
        } catch (error) {
            console.error('Error getting top accounts (alternative method):', error);
            return [];
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