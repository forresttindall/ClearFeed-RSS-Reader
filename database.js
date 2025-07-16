const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');
const fs = require('fs');

// Use the app's user data directory for the database
const dbPath = path.join(app.getPath('userData'), 'rss.db');

console.log('Current working directory:', process.cwd());
console.log('Database path:', dbPath);
console.log('Environment:', process.env.NODE_ENV);

// Ensure the directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    console.log('Creating database directory:', dbDir);
    fs.mkdirSync(dbDir, { recursive: true });
}

// Delete existing database if it exists (for development)
if (process.env.NODE_ENV === 'development') {
    if (fs.existsSync(dbPath)) {
        console.log('Development mode: Deleting existing database');
        fs.unlinkSync(dbPath);
    }
    console.log('Development mode: Will create new database');
}

let db;
try {
    db = new Database(dbPath);
    console.log('Connected to SQLite database at:', dbPath);
} catch (err) {
    console.error('Database connection error:', err);
    console.error('Error details:', err.message);
    process.exit(1);
}

// Enable foreign keys and initialize schema
console.log('Initializing database schema...');

try {
    // Enable foreign keys
    db.pragma('foreign_keys = ON');
    console.log('Foreign keys enabled');
    
    // Performance optimizations
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = 10000');
    db.pragma('temp_store = MEMORY');
    console.log('Database performance optimizations applied');

    // Create feeds table
    const createFeedsTable = `
        CREATE TABLE IF NOT EXISTS feeds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            url TEXT UNIQUE NOT NULL,
            description TEXT,
            lastFetched TEXT
        )
    `;
    
    db.exec(createFeedsTable);
    console.log('Feeds table created successfully');

    // Create articles table
    const createArticlesTable = `
        CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            link TEXT NOT NULL,
            publishedAt TEXT NOT NULL,
            feedId INTEGER NOT NULL,
            imageUrl TEXT,
            author TEXT,
            description TEXT,
            read INTEGER DEFAULT 0,
            FOREIGN KEY (feedId) REFERENCES feeds (id),
            UNIQUE(link, feedId)
        )
    `;
    
    db.exec(createArticlesTable);
    console.log('Articles table created successfully');
    
    // Create indexes for better performance
    const createIndexes = `
        CREATE INDEX IF NOT EXISTS idx_articles_link_feed 
        ON articles(link, feedId);
        
        CREATE INDEX IF NOT EXISTS idx_articles_feedId 
        ON articles(feedId);
        
        CREATE INDEX IF NOT EXISTS idx_articles_publishedAt 
        ON articles(publishedAt);
        
        CREATE INDEX IF NOT EXISTS idx_articles_read 
        ON articles(read);
    `;
    
    db.exec(createIndexes);
    console.log('Database indexes created successfully');

    // Verify tables were created
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log('Database tables:', tables);

    console.log('Database initialization completed successfully');
} catch (err) {
    console.error('Error initializing database schema:', err);
    console.error('Error details:', err.message);
}

process.on('exit', () => {
    console.log('Closing database connection...');
    if (db) {
        db.close();
    }
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, closing database...');
    if (db) {
        db.close();
    }
    process.exit(0);
});

module.exports = db;