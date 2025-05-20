const db = require('./connection');

// Main migration function
async function runMigrations() {
    try {
        console.log('🔄 Running database migrations...');

        // Create users table
        await db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                discord_id TEXT UNIQUE NOT NULL,
                username TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create accounts table
        await db.run(`
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nickname TEXT NOT NULL,
                rp_amount INTEGER NOT NULL DEFAULT 0,
                friends_count INTEGER NOT NULL DEFAULT 0,
                max_friends INTEGER NOT NULL DEFAULT 250,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create friendships table
        await db.run(`
            CREATE TABLE IF NOT EXISTS friendships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                account_id INTEGER NOT NULL,
                lol_nickname TEXT NOT NULL,
                lol_tag TEXT NOT NULL,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
                UNIQUE(user_id, account_id)
            )
        `);

        // Create carts table
        await db.run(`
            CREATE TABLE IF NOT EXISTS carts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                ticket_channel_id TEXT UNIQUE NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                total_rp INTEGER NOT NULL DEFAULT 0,
                total_price REAL NOT NULL DEFAULT 0.00,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);

        // Create cart_items table
        await db.run(`
            CREATE TABLE IF NOT EXISTS cart_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cart_id INTEGER NOT NULL,
                skin_name TEXT NOT NULL,
                skin_price INTEGER NOT NULL,
                skin_image_url TEXT,
                category TEXT,
                original_item_id INTEGER,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE
            )
        `);

        // Create orders table (for completed orders)
        await db.run(`
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cart_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                payment_method TEXT,
                payment_proof TEXT,
                total_rp INTEGER NOT NULL,
                total_price REAL NOT NULL,
                completed_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (cart_id) REFERENCES carts(id),
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        console.log('✅ Database migrations completed successfully!');
    } catch (error) {
        console.error('❌ Error running migrations:', error);
        throw error;
    }
}

// Migration to add indexes for better performance
async function createIndexes() {
    try {
        console.log('🔄 Creating database indexes...');

        const indexes = [
            'CREATE INDEX IF NOT EXISTS idx_users_discord_id ON users(discord_id)',
            'CREATE INDEX IF NOT EXISTS idx_carts_user_id ON carts(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_carts_status ON carts(status)',
            'CREATE INDEX IF NOT EXISTS idx_carts_channel_id ON carts(ticket_channel_id)',
            'CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id)',
            'CREATE INDEX IF NOT EXISTS idx_cart_items_category ON cart_items(category)',
            'CREATE INDEX IF NOT EXISTS idx_cart_items_original_id ON cart_items(original_item_id)',
            'CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_friendships_account_id ON friendships(account_id)',
            'CREATE INDEX IF NOT EXISTS idx_friendships_unique ON friendships(user_id, account_id)',
            'CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
            'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)'
        ];

        for (const indexSql of indexes) {
            await db.run(indexSql);
        }
        
        console.log('✅ Database indexes created/verified');
    } catch (error) {
        console.error('❌ Error creating indexes:', error);
        throw error;
    }
}

// Add triggers for automatic timestamp updates
async function createTriggers() {
    try {
        console.log('🔄 Creating database triggers...');

        // Trigger to update updated_at column on carts table
        await db.run(`
            CREATE TRIGGER IF NOT EXISTS update_carts_timestamp 
            AFTER UPDATE ON carts
            BEGIN
                UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
            END
        `);

        console.log('✅ Database triggers created');
    } catch (error) {
        console.error('❌ Error creating triggers:', error);
        throw error;
    }
}

// Function to run all migrations and setup
async function runMigrationsWithIndexes() {
    try {
        await runMigrations();
        await createIndexes();
        await createTriggers();
        console.log('✅ Full database setup completed!');
    } catch (error) {
        console.error('❌ Error in full database setup:', error);
        throw error;
    }
}

// Check database integrity
async function checkDatabaseIntegrity() {
    try {
        console.log('🔍 Checking database integrity...');
        
        const result = await db.get('PRAGMA integrity_check');
        if (result.integrity_check === 'ok') {
            console.log('✅ Database integrity check passed');
            return true;
        } else {
            console.error('❌ Database integrity check failed:', result);
            return false;
        }
    } catch (error) {
        console.error('❌ Error checking database integrity:', error);
        return false;
    }
}

// Get database statistics
async function getDatabaseStats() {
    try {
        const stats = {};
        
        // Get table counts
        const tables = ['users', 'accounts', 'friendships', 'carts', 'cart_items', 'orders'];
        
        for (const table of tables) {
            try {
                const result = await db.get(`SELECT COUNT(*) as count FROM ${table}`);
                stats[table] = result.count;
            } catch (error) {
                stats[table] = 'Error';
            }
        }

        // Get database size (SQLite specific)
        try {
            const sizeResult = await db.get('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()');
            stats.database_size_bytes = sizeResult.size;
            stats.database_size_mb = (sizeResult.size / 1024 / 1024).toFixed(2);
        } catch (error) {
            stats.database_size = 'Error';
        }

        return stats;
    } catch (error) {
        console.error('❌ Error getting database stats:', error);
        return {};
    }
}

// Clean up old data (utility function)
async function cleanupOldData(daysOld = 30) {
    try {
        console.log(`🧹 Cleaning up data older than ${daysOld} days...`);

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        const cutoffISO = cutoffDate.toISOString();

        // Clean up old cancelled carts
        const cartResult = await db.run(
            'DELETE FROM carts WHERE status = ? AND created_at < ?',
            ['cancelled', cutoffISO]
        );

        // Clean up old completed orders (keep records but clean related data)
        const orderResult = await db.run(
            'DELETE FROM orders WHERE status = ? AND created_at < ?',
            ['completed', cutoffISO]
        );

        console.log(`✅ Cleanup completed: ${cartResult.changes} carts, ${orderResult.changes} orders removed`);
        
        return {
            cartsRemoved: cartResult.changes,
            ordersRemoved: orderResult.changes
        };
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        throw error;
    }
}

// Export all functions
module.exports = {
    runMigrations,
    runMigrationsWithIndexes,
    createIndexes,
    createTriggers,
    checkDatabaseIntegrity,
    getDatabaseStats,
    cleanupOldData
};