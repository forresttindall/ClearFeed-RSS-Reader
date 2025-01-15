const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('rss.db', (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to SQLite database');
    }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Create tables with proper error handling
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS feeds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT UNIQUE
    )`, (err) => {
        if (err) console.error('Error creating feeds table:', err);
    });

    db.run(`CREATE TABLE IF NOT EXISTS articles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        link TEXT NOT NULL,
        publishedAt TEXT NOT NULL,
        feedId INTEGER NOT NULL,
        imageUrl TEXT,
        author TEXT,
        description TEXT,
        read INTEGER DEFAULT 0,
        FOREIGN KEY (feedId) REFERENCES feeds (id)
    )`, (err) => {
        if (err) console.error('Error creating articles table:', err);
    });
});

module.exports = db; 