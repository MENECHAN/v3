// database/connection.js - Enhanced version with better error handling

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
    constructor() {
        this.db = null;
        this.dbPath = './database.db';
        this.initialized = false;
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            if (this.initialized && this.db) {
                console.log('Database already initialized');
                return resolve();
            }
            
            try {
                this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
                    if (err) {
                        console.error('Error opening database:', err);
                        reject(err);
                    } else {
                        console.log('Connected to SQLite database');
                        this.initialized = true;
                        
                        // Enable foreign keys
                        this.db.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
                            if (pragmaErr) {
                                console.warn('Warning: Could not enable foreign keys:', pragmaErr);
                            } else {
                                console.log('Foreign keys enabled');
                            }
                            resolve();
                        });
                    }
                });
            } catch (error) {
                console.error('Critical error initializing database:', error);
                reject(error);
            }
        });
    }

    async run(sql, params = []) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    // Enhanced error reporting
                    console.error(`Error executing SQL: ${sql}`);
                    console.error(`Parameters:`, params);
                    console.error(`SQLite error:`, err);
                    
                    // Augment the error with more details
                    err.sql = sql;
                    err.params = params;
                    err.__augmented = true;
                    
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    async get(sql, params = []) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    console.error(`Error executing SQL: ${sql}`);
                    console.error(`Parameters:`, params);
                    err.sql = sql;
                    err.params = params;
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async all(sql, params = []) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error(`Error executing SQL: ${sql}`);
                    console.error(`Parameters:`, params);
                    err.sql = sql;
                    err.params = params;
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async ensureInitialized() {
        if (!this.initialized || !this.db) {
            console.log('Database not initialized. Initializing now...');
            await this.initialize();
        }
    }

    async close() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                return resolve();
            }
            
            this.db.close((err) => {
                if (err) {
                    reject(err);
                } else {
                    this.initialized = false;
                    this.db = null;
                    console.log('Database connection closed');
                    resolve();
                }
            });
        });
    }
    
    async exec(sql) {
        await this.ensureInitialized();
        
        return new Promise((resolve, reject) => {
            this.db.exec(sql, (err) => {
                if (err) {
                    console.error(`Error executing SQL: ${sql}`);
                    err.sql = sql;
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
    
    // Check if database exists
    async exists() {
        const fs = require('fs');
        return fs.existsSync(this.dbPath);
    }
    
    // Get database info
    async getInfo() {
        await this.ensureInitialized();
        
        try {
            const version = await this.get('SELECT sqlite_version() as version');
            const tables = await this.all("SELECT name FROM sqlite_master WHERE type='table'");
            const dbSize = require('fs').statSync(this.dbPath).size;
            
            return {
                version: version.version,
                tables: tables.map(t => t.name),
                size: dbSize,
                sizeFormatted: `${(dbSize / 1024 / 1024).toFixed(2)} MB`
            };
        } catch (error) {
            console.error('Error getting database info:', error);
            throw error;
        }
    }
}

// Create a singleton instance
const database = new Database();

// Export the singleton
module.exports = database;