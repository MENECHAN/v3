const db = require('../database/connection');

class FriendshipLog {
    static async findById(id) {
        try {
            const query = 'SELECT * FROM friendship_logs WHERE id = ?';
            return await db.get(query, [id]);
        } catch (error) {
            console.error('Error finding friendship log by ID:', error);
            throw error;
        }
    }

    static async findByUserId(userId) {
        try {
            const query = `
                SELECT fl.*, a.nickname as account_nickname 
                FROM friendship_logs fl
                LEFT JOIN accounts a ON fl.account_id = a.id
                WHERE fl.user_id = ?
                ORDER BY fl.created_at DESC
            `;
            return await db.all(query, [userId]);
        } catch (error) {
            console.error('Error finding friendship logs by user ID:', error);
            throw error;
        }
    }

    static async findByAccountId(accountId) {
        try {
            const query = `
                SELECT fl.*, u.username, u.discord_id 
                FROM friendship_logs fl
                LEFT JOIN users u ON fl.user_id = u.id
                WHERE fl.account_id = ?
                ORDER BY fl.created_at DESC
            `;
            return await db.all(query, [accountId]);
        } catch (error) {
            console.error('Error finding friendship logs by account ID:', error);
            throw error;
        }
    }

    static async findPendingRequest(userId, accountId) {
        try {
            const query = 'SELECT * FROM friendship_logs WHERE user_id = ? AND account_id = ? AND status = ?';
            return await db.get(query, [userId, accountId, 'pending']);
        } catch (error) {
            console.error('Error finding pending friendship request:', error);
            throw error;
        }
    }

    static async create(userId, accountId, lolNickname, lolTag, status = 'pending') {
        try {
            const query = `
                INSERT INTO friendship_logs (user_id, account_id, lol_nickname, lol_tag, status) 
                VALUES (?, ?, ?, ?, ?)
            `;
            const result = await db.run(query, [userId, accountId, lolNickname, lolTag, status]);
            return result.lastID;
        } catch (error) {
            console.error('Error creating friendship log:', error);
            throw error;
        }
    }

    static async updateStatus(id, status, adminId = null, adminResponse = null) {
        try {
            const query = `
                UPDATE friendship_logs 
                SET status = ?, admin_id = ?, admin_response = ?, processed_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `;
            const result = await db.run(query, [status, adminId, adminResponse, id]);
            return result.changes > 0;
        } catch (error) {
            console.error('Error updating friendship log status:', error);
            throw error;
        }
    }

    static async findPendingRequests(limit = 50) {
        try {
            const query = `
                SELECT fl.*, u.username, u.discord_id, a.nickname as account_nickname
                FROM friendship_logs fl
                LEFT JOIN users u ON fl.user_id = u.id
                LEFT JOIN accounts a ON fl.account_id = a.id
                WHERE fl.status = 'pending'
                ORDER BY fl.created_at ASC
                LIMIT ?
            `;
            return await db.all(query, [limit]);
        } catch (error) {
            console.error('Error finding pending friendship requests:', error);
            throw error;
        }
    }

    static async getStatistics() {
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_requests,
                    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
                    COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_requests,
                    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_requests
                FROM friendship_logs
            `;
            const result = await db.get(query);
            
            return {
                totalRequests: result.total_requests,
                pendingRequests: result.pending_requests || 0,
                approvedRequests: result.approved_requests || 0,
                rejectedRequests: result.rejected_requests || 0
            };
        } catch (error) {
            console.error('Error getting friendship log statistics:', error);
            throw error;
        }
    }

    static async getRecentRequests(limit = 10) {
        try {
            const query = `
                SELECT fl.*, u.username, u.discord_id, a.nickname as account_nickname
                FROM friendship_logs fl
                LEFT JOIN users u ON fl.user_id = u.id
                LEFT JOIN accounts a ON fl.account_id = a.id
                ORDER BY fl.created_at DESC
                LIMIT ?
            `;
            return await db.all(query, [limit]);
        } catch (error) {
            console.error('Error getting recent friendship requests:', error);
            throw error;
        }
    }

    static async deleteOldLogs(daysOld = 90) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const query = `
                DELETE FROM friendship_logs 
                WHERE created_at < ? AND status != 'pending'
            `;
            const result = await db.run(query, [cutoffDate.toISOString()]);
            return result.changes;
        } catch (error) {
            console.error('Error deleting old friendship logs:', error);
            throw error;
        }
    }
}

module.exports = FriendshipLog;