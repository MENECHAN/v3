const db = require('../database/connection');

class Friendship {
    static async findById(id) {
        try {
            const query = 'SELECT * FROM friendships WHERE id = ?';
            return await db.get(query, [id]);
        } catch (error) {
            console.error('Error finding friendship by ID:', error);
            throw error;
        }
    }

    static async findByUserId(userId) {
        try {
            const query = `
                SELECT f.*, a.nickname as account_nickname 
                FROM friendships f
                JOIN accounts a ON f.account_id = a.id
                WHERE f.user_id = ?
                ORDER BY f.added_at DESC
            `;
            return await db.all(query, [userId]);
        } catch (error) {
            console.error('Error finding friendships by user ID:', error);
            throw error;
        }
    }

    static async findByAccountId(accountId) {
        try {
            const query = `
                SELECT f.*, u.username, u.discord_id 
                FROM friendships f
                JOIN users u ON f.user_id = u.id
                WHERE f.account_id = ?
                ORDER BY f.added_at DESC
            `;
            return await db.all(query, [accountId]);
        } catch (error) {
            console.error('Error finding friendships by account ID:', error);
            throw error;
        }
    }

    static async findByUserAndAccount(userId, accountId) {
        try {
            const query = 'SELECT * FROM friendships WHERE user_id = ? AND account_id = ?';
            return await db.get(query, [userId, accountId]);
        } catch (error) {
            console.error('Error finding friendship by user and account:', error);
            throw error;
        }
    }

    static async create(userId, accountId, lolNickname, lolTag) {
        try {
            const query = `
                INSERT INTO friendships (user_id, account_id, lol_nickname, lol_tag) 
                VALUES (?, ?, ?, ?)
            `;
            const result = await db.run(query, [userId, accountId, lolNickname, lolTag]);
            return result.lastID;
        } catch (error) {
            console.error('Error creating friendship:', error);
            throw error;
        }
    }

    static async delete(id) {
        try {
            // Get friendship info before deleting
            const friendship = await this.findById(id);
            
            if (!friendship) {
                return false;
            }

            const query = 'DELETE FROM friendships WHERE id = ?';
            const result = await db.run(query, [id]);
            
            if (result.changes > 0) {
                // Decrement friend count on account
                const Account = require('./Account');
                await Account.decrementFriendCount(friendship.account_id);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error deleting friendship:', error);
            throw error;
        }
    }

    static async deleteByUserAndAccount(userId, accountId) {
        try {
            const query = 'DELETE FROM friendships WHERE user_id = ? AND account_id = ?';
            const result = await db.run(query, [userId, accountId]);
            
            if (result.changes > 0) {
                // Decrement friend count on account
                const Account = require('./Account');
                await Account.decrementFriendCount(accountId);
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error deleting friendship by user and account:', error);
            throw error;
        }
    }

    static async updateLolNickname(id, lolNickname, lolTag) {
        try {
            const query = 'UPDATE friendships SET lol_nickname = ?, lol_tag = ? WHERE id = ?';
            const result = await db.run(query, [lolNickname, lolTag, id]);
            return result.changes > 0;
        } catch (error) {
            console.error('Error updating LoL nickname:', error);
            throw error;
        }
    }

    static async findByLolNickname(lolNickname, lolTag) {
        try {
            const query = 'SELECT * FROM friendships WHERE lol_nickname = ? AND lol_tag = ?';
            return await db.all(query, [lolNickname, lolTag]);
        } catch (error) {
            console.error('Error finding friendships by LoL nickname:', error);
            throw error;
        }
    }

    static async count() {
        try {
            const query = 'SELECT COUNT(*) as count FROM friendships';
            const result = await db.get(query);
            return result.count;
        } catch (error) {
            console.error('Error counting friendships:', error);
            throw error;
        }
    }

static async getStatistics() {
    try {
        const query = `
            SELECT 
                COUNT(*) as total_friendships,
                COUNT(DISTINCT f.user_id) as users_with_friends,
                COUNT(DISTINCT f.account_id) as accounts_with_friends,
                AVG(friends_per_user.friend_count) as avg_friends_per_user
            FROM friendships f
            JOIN (
                SELECT user_id, COUNT(*) as friend_count
                FROM friendships
                GROUP BY user_id
            ) friends_per_user ON f.user_id = friends_per_user.user_id
        `;
        const result = await db.get(query);
        
        return {
            totalFriendships: result.total_friendships,
            usersWithFriends: result.users_with_friends || 0,
            accountsWithFriends: result.accounts_with_friends || 0,
            averageFriendsPerUser: result.avg_friends_per_user || 0
        };
    } catch (error) {
        console.error('Error getting friendship statistics:', error);
        throw error;
    }
}

    static async getRecentFriendships(limit = 10) {
        try {
            const query = `
                SELECT f.*, u.username, a.nickname as account_nickname
                FROM friendships f
                JOIN users u ON f.user_id = u.id
                JOIN accounts a ON f.account_id = a.id
                ORDER BY f.added_at DESC
                LIMIT ?
            `;
            return await db.all(query, [limit]);
        } catch (error) {
            console.error('Error getting recent friendships:', error);
            throw error;
        }
    }

    static async getFriendshipsByDateRange(startDate, endDate) {
        try {
            const query = `
                SELECT f.*, u.username, a.nickname as account_nickname
                FROM friendships f
                JOIN users u ON f.user_id = u.id
                JOIN accounts a ON f.account_id = a.id
                WHERE f.added_at BETWEEN ? AND ?
                ORDER BY f.added_at DESC
            `;
            return await db.all(query, [startDate, endDate]);
        } catch (error) {
            console.error('Error getting friendships by date range:', error);
            throw error;
        }
    }

    static async getTopAccounts(limit = 10) {
        try {
            const query = `
                SELECT 
                    a.id,
                    a.nickname,
                    COUNT(f.id) as friend_count,
                    a.max_friends,
                    ROUND((COUNT(f.id) * 100.0 / a.max_friends), 2) as fill_percentage
                FROM accounts a
                LEFT JOIN friendships f ON a.id = f.account_id
                GROUP BY a.id
                ORDER BY friend_count DESC
                LIMIT ?
            `;
            return await db.all(query, [limit]);
        } catch (error) {
            console.error('Error getting top accounts by friends:', error);
            throw error;
        }
    }

    static async getUsersFriendships(userId) {
        try {
            const query = `
                SELECT 
                    f.*,
                    a.nickname as account_nickname,
                    a.rp_amount,
                    a.friends_count,
                    a.max_friends
                FROM friendships f
                JOIN accounts a ON f.account_id = a.id
                WHERE f.user_id = ?
                ORDER BY f.added_at DESC
            `;
            return await db.all(query, [userId]);
        } catch (error) {
            console.error('Error getting user friendships:', error);
            throw error;
        }
    }

    static async checkFriendshipExists(userId, accountId) {
        try {
            const friendship = await this.findByUserAndAccount(userId, accountId);
            return !!friendship;
        } catch (error) {
            console.error('Error checking if friendship exists:', error);
            throw error;
        }
    }

    static async getFriendshipAge(id) {
        try {
            const friendship = await this.findById(id);
            if (!friendship) return null;

            const now = new Date();
            const addedAt = new Date(friendship.added_at);
            const ageInMs = now - addedAt;
            const ageInDays = Math.floor(ageInMs / (1000 * 60 * 60 * 24));

            return {
                days: ageInDays,
                hours: Math.floor(ageInMs / (1000 * 60 * 60)),
                minutes: Math.floor(ageInMs / (1000 * 60))
            };
        } catch (error) {
            console.error('Error getting friendship age:', error);
            throw error;
        }
    }

    static async cleanupOldFriendships(daysOld = 30) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const query = `
                DELETE FROM friendships 
                WHERE added_at < ?
            `;
            const result = await db.run(query, [cutoffDate.toISOString()]);
            return result.changes;
        } catch (error) {
            console.error('Error cleaning up old friendships:', error);
            throw error;
        }
    }
}

module.exports = Friendship;