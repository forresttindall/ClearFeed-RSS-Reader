const express = require('express');
const RSSParser = require('rss-parser');
const cors = require('cors');
const db = require('./database');

const app = express();

// Middleware setup - order is important!
app.use(cors());
app.use(express.json());  // This is crucial for parsing JSON request bodies
app.use(express.urlencoded({ extended: true }));

const parser = new RSSParser({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    },
    timeout: 5000,
    requestOptions: {
        rejectUnauthorized: false
    }
});

// Test route to verify server is working
app.get('/test', (req, res) => {
    res.json({ message: 'Server is working' });
});

// Add feed route
app.post('/feeds', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const feedData = await parser.parseURL(url);
        console.log('Feed parsed successfully:', feedData.title);
        
        // Debug log for first item
        console.log('First item debug:', {
            title: feedData.items[0].title,
            image: feedData.items[0].enclosure,
            mediaContent: feedData.items[0]['media:content'],
            itemImage: feedData.items[0].image,
            fullItem: feedData.items[0]
        });

        db.run(`INSERT INTO feeds (url) VALUES (?)`, [url], async function (err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: err.message });
            }

            const feedId = this.lastID;
            console.log('Feed inserted with ID:', feedId);

            const articlePromises = feedData.items.map(item => {
                return new Promise((resolve, reject) => {
                    // Debug logging for image sources
                    console.log('Article:', item.title);
                    console.log('Media content:', item['media:content']);
                    console.log('Enclosure:', item.enclosure);
                    
                    console.log('Media thumbnail:', item['media:thumbnail']);
                    console.log('Content:', item.content);
                    console.log('Description:', item.description);
                    console.log('Full item:', JSON.stringify(item, null, 2));

                    // Get image URL (try multiple possible sources)
                    let imageUrl = null;
                    
                    // Try to get image from media:content
                    if (item['media:content'] && item['media:content'].$) {
                        imageUrl = item['media:content'].$.url;
                    }
                    // Try to get image from enclosures
                    else if (item.enclosure && item.enclosure.url) {
                        imageUrl = item.enclosure.url;
                    }
                    // Try to get image from media:thumbnail
                    else if (item['media:thumbnail'] && item['media:thumbnail'].$) {
                        imageUrl = item['media:thumbnail'].$.url;
                    }
                    // Try to get first image from content/description
                    else if (item.content || item.description) {
                        const content = item.content || item.description;
                        const imgMatch = content.match(/<img[^>]+src="([^">]+)"/);
                        if (imgMatch) {
                            imageUrl = imgMatch[1];
                        }
                    }
                    
                    console.log('Found image URL:', imageUrl);

                    // Get author and description (existing code)
                    let author = item.author || 
                                item.creator || 
                                item['dc:creator'] || 
                                null;
                                
                    let description = item.description || 
                                     item.summary || 
                                     item.content || 
                                     null;
                                     
                    if (description) {
                        // Clean up HTML entities and special characters
                        description = description
                            .replace(/<[^>]*>/g, ' ')  // Remove HTML tags
                            .replace(/&\w+;/g, '')     // Remove HTML entities
                            .replace(/&#\d+;/g, '')    // Remove numeric HTML entities
                            .replace(/\s+/g, ' ')      // Normalize whitespace
                            .replace(/[^\w\s.,!?-]/g, '')  // Remove special characters except basic punctuation
                            .trim();
                        
                        description = description.substring(0, 200) + (description.length > 200 ? '...' : '');
                    }

                    db.run(
                        `INSERT OR REPLACE INTO articles (
                            title, link, publishedAt, feedId, imageUrl, author, description
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [
                            item.title,
                            item.link,
                            new Date(item.pubDate).toISOString(),
                            feedId,
                            imageUrl,
                            author,
                            description
                        ],
                        function(err) {
                            if (err) reject(err);
                            else resolve(this.lastID);
                        }
                    );
                });
            });

            try {
                await Promise.all(articlePromises);
                res.json({ success: true, feedId });
            } catch (error) {
                console.error('Error inserting articles:', error);
                res.status(500).json({ error: 'Error inserting articles' });
            }
        });
    } catch (error) {
        console.error('Feed parsing error:', error);
        res.status(400).json({ error: 'Invalid RSS feed URL or feed not accessible' });
    }
});

// Get feeds route
app.get('/feeds', (req, res) => {
    db.all(`SELECT * FROM feeds`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching feeds:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows || []);
    });
});

// Get articles route
app.get('/articles', (req, res) => {
    db.all(`SELECT * FROM articles ORDER BY publishedAt DESC`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching articles:', err);
            return res.status(500).json({ error: err.message });
        }
        // Log the first article to check if it has an image URL
        if (rows.length > 0) {
            console.log('First article data:', rows[0]);
        }
        res.json(rows || []);
    });
});

// Add this new endpoint
app.patch('/articles/:id/read', async (req, res) => {
    const { id } = req.params;
    console.log('Marking article as read:', id);
    
    db.run(
        `UPDATE articles SET read = 1 WHERE id = ?`,
        [id],
        function(err) {
            if (err) {
                console.error('Error marking article as read:', err);
                return res.status(500).json({ error: err.message });
            }
            console.log('Article marked as read. Changes:', this.changes);
            res.json({ success: true, changes: this.changes });
        }
    );
});

// Delete feed endpoint
app.delete('/feeds/:id', (req, res) => {
    const { id } = req.params;
    console.log('Attempting to delete feed:', id);
    
    db.serialize(() => {
        // Use a transaction to ensure both operations complete
        db.run('BEGIN TRANSACTION');
        
        db.run('DELETE FROM articles WHERE feedId = ?', [id], (err) => {
            if (err) {
                console.error('Error deleting articles:', err);
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
            }
            
            db.run('DELETE FROM feeds WHERE id = ?', [id], (err) => {
                if (err) {
                    console.error('Error deleting feed:', err);
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: err.message });
                }
                
                db.run('COMMIT', (err) => {
                    if (err) {
                        console.error('Error committing transaction:', err);
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: err.message });
                    }
                    
                    console.log('Successfully deleted feed and its articles');
                    res.status(200).json({ success: true });
                });
            });
        });
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something broke!' });
});

const PORT = 3001;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});