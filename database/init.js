// database/init.js - New file to handle database initialization safely

const db = require('./connection');
const schemaFix = require('./schema-fix');
const path = require('path');
const fs = require('fs');

async function checkAndBackupDatabase() {
    const dbPath = './database.db';
    
    // Check if database exists
    if (fs.existsSync(dbPath)) {
        try {
            console.log('🔍 Existing database found. Creating backup...');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `./database-backup-${timestamp}.db`;
            
            fs.copyFileSync(dbPath, backupPath);
            console.log(`✅ Database backup created: ${backupPath}`);
            return true;
        } catch (error) {
            console.error('❌ Error creating database backup:', error);
            return false;
        }
    }
    
    console.log('ℹ️ No existing database found. Will create a new one.');
    return false;
}

async function initializeDatabase() {
    try {
        console.log('🚀 Starting database initialization...');
        
        // Create backup of existing database if any
        await checkAndBackupDatabase();
        
        // Initialize database connection
        await db.initialize();
        console.log('✅ Database connection initialized');
        
        // Apply schema fixes
        await schemaFix.applyDatabaseFixes();
        console.log('✅ Database schema fixed and updated');
        
        // Log database info
        const dbInfo = await db.getInfo();
        console.log('📊 Database information:');
        console.log(`   - SQLite version: ${dbInfo.version}`);
        console.log(`   - Database size: ${dbInfo.sizeFormatted}`);
        console.log(`   - Tables (${dbInfo.tables.length}): ${dbInfo.tables.join(', ')}`);
        
        console.log('🎉 Database initialization completed successfully!');
        return true;
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        console.error('Error details:', error.message);
        
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
        
        return false;
    }
}

module.exports = {
    initializeDatabase
};