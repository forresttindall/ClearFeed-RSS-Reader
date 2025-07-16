const { ipcMain } = require('electron');
const RSSParser = require('rss-parser');
const db = require('./database');

const parser = new RSSParser({
    headers: {
        'User-Agent': 'ClearFeed Desktop RSS Reader'
    },
    timeout: 5000,
    requestOptions: {
        rejectUnauthorized: false
    }
});

function extractImageUrl(item, feedData) {
    let imageUrl = null;

    // Try enclosure first (many RSS feeds use this for images)
    if (item.enclosure && item.enclosure.url) {
        const enclosureType = item.enclosure.type || '';
        if (enclosureType.startsWith('image/')) {
            return item.enclosure.url;
        }
    }

    // Try media:thumbnail (Wired and many modern feeds use this)
    if (item['media:thumbnail']) {
        // Handle both single thumbnail and array of thumbnails
        if (Array.isArray(item['media:thumbnail'])) {
            // Sort by width to get the largest thumbnail
            const thumbnails = item['media:thumbnail']
                .filter(t => t.$ && t.$.url && t.$.width)
                .sort((a, b) => parseInt(b.$.width) - parseInt(a.$.width));
            
            if (thumbnails.length > 0) {
                return thumbnails[0].$.url;
            }
        } else if (item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
            return item['media:thumbnail'].$.url;
        }
    }

    // Try media:content as fallback
    if (item['media:content']) {
        if (Array.isArray(item['media:content'])) {
            const mediaContent = item['media:content']
                .filter(m => {
                    // Only consider image content
                    if (m.$ && m.$.type && !m.$.type.startsWith('image/')) {
                        return false;
                    }
                    return m.$ && m.$.url;
                })
                .sort((a, b) => {
                    // Sort by width if available
                    if (a.$.width && b.$.width) {
                        return parseInt(b.$.width) - parseInt(a.$.width);
                    }
                    return 0;
                });

            if (mediaContent.length > 0) {
                return mediaContent[0].$.url;
            }
        } else if (item['media:content'].$ && item['media:content'].$.url) {
            return item['media:content'].$.url;
        }
    }

    // Try content/description with optimized regex patterns
    if (item.content || item.description) {
        const content = item.content || item.description;
        
        // Single optimized regex for better performance
        const imgPattern = /<img[^>]+src=["']([^"'>]+)["'][^>]*>/i;
        const match = content.match(imgPattern);
        
        if (match && match[1]) {
            let url = match[1];
            if (url && !url.includes('favicon') && 
                !url.includes('icon') && 
                !url.includes('pixel') &&
                !url.includes('tracking') &&
                !url.includes('1x1') &&
                url.length > 20) {
                
                // Decode HTML entities
                url = url.replace(/&amp;/g, '&')
                         .replace(/&#038;/g, '&')
                         .replace(/&lt;/g, '<')
                         .replace(/&gt;/g, '>')
                         .replace(/&quot;/g, '"')
                         .replace(/&#39;/g, "'");
                
                return url;
            }
        }
    }

    // Try iTunes image (for podcast feeds)
    if (item['itunes:image'] && item['itunes:image'].$ && item['itunes:image'].$.href) {
        return item['itunes:image'].$.href;
    }

    // Try feed-level image as last resort
    if (feedData.image && feedData.image.url) {
        return feedData.image.url;
    }

    return null;
}

function setupIPC() {
    console.log('Setting up IPC handlers...');
    
    // Log all channels we're setting up
    const channels = [
        'fetch-feeds',
        'fetch-articles',
        'add-feed',
        'mark-as-read',
        'delete-feed',
        'log-popup-attempt'
    ];
    
    console.log('Registering IPC channels:', channels);
    
    // Handle feed fetching
    ipcMain.handle('fetch-feeds', async () => {
        try {
            const stmt = db.prepare('SELECT * FROM feeds');
            const rows = stmt.all();
            return rows || [];
        } catch (err) {
            console.error('Error fetching feeds:', err);
            throw err;
        }
    });

    // Handle article fetching
    ipcMain.handle('fetch-articles', async () => {
        try {
            const stmt = db.prepare('SELECT * FROM articles ORDER BY publishedAt DESC');
            const rows = stmt.all();
            
            console.log('\n--- Fetched Articles ---');
            console.log('Total articles found:', rows.length);
            
            if (rows.length === 0) {
                console.log('No articles found in database. You may need to add some RSS feeds first.');
                return [];
            }
            
            rows.slice(0, 3).forEach(article => {
                console.log(`\nArticle: ${article.title}`);
                console.log('Image URL:', article.imageUrl);
                console.log('Feed ID:', article.feedId);
            });
            
            return rows || [];
        } catch (err) {
            console.error('Error fetching articles:', err);
            throw err;
        }
    });

    // Handle adding new feeds
    ipcMain.handle('add-feed', async (event, { url }) => {
        try {
            // First check if feed already exists
            const existingFeedStmt = db.prepare('SELECT * FROM feeds WHERE url = ?');
            const existingFeed = existingFeedStmt.get(url);

            if (existingFeed) {
                return { 
                    success: false, 
                    error: 'This feed has already been added' 
                };
            }

            const feedData = await parser.parseURL(url);
            
            // Insert the feed with title and description
            const insertFeedStmt = db.prepare('INSERT INTO feeds (url, title, description) VALUES (?, ?, ?)');
            const feedResult = insertFeedStmt.run(url, feedData.title, feedData.description);
            const feedId = feedResult.lastInsertRowid;

            // Prepare the article insert statement
            const insertArticleStmt = db.prepare(`
                INSERT OR IGNORE INTO articles (
                    title, link, publishedAt, feedId, imageUrl, author, description
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            // Process articles in batches for better performance
            const batchSize = 10;
            const articles = feedData.items || [];
            
            for (let i = 0; i < articles.length; i += batchSize) {
                const batch = articles.slice(i, i + batchSize);
                
                // Use transaction for batch processing
                const transaction = db.transaction(() => {
                    for (const item of batch) {
                        const imageUrl = extractImageUrl(item, feedData);
                        
                        // Get author and description
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
                                .replace(/<[^>]*>/g, ' ')
                                .replace(/&\w+;/g, '')
                                .replace(/&#\d+;/g, '')
                                .replace(/\s+/g, ' ')
                                .replace(/[^\w\s.,!?-]/g, '')
                                .trim();
                            
                            description = description.substring(0, 200) + (description.length > 200 ? '...' : '');
                        }

                        try {
                            insertArticleStmt.run(
                                item.title,
                                item.link,
                                new Date(item.pubDate).toISOString(),
                                feedId,
                                imageUrl,
                                author,
                                description
                            );
                        } catch (err) {
                            console.error('Database error while inserting article:', err);
                        }
                    }
                });
                
                transaction();
            }

            return { 
                success: true, 
                feedId,
                feedTitle: feedData.title 
            };
        } catch (error) {
            console.error('Error in add-feed handler:', error);
            
            if (error.message.includes('Status code')) {
                throw new Error(`Unable to access this feed. Status: ${error.message}`);
            }
            if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
                throw new Error('Network error: Unable to connect to the feed URL. Please check your internet connection and try again.');
            }
            if (error.message.includes('timeout')) {
                throw new Error('Request timeout: The feed server is taking too long to respond. Please try again later.');
            }
            if (error.message.includes('Invalid XML') || error.message.includes('Non-whitespace')) {
                throw new Error('Invalid RSS format: The URL does not contain valid RSS/XML content.');
            }
            
            // Provide the actual error message for debugging
            throw new Error(`Feed parsing error: ${error.message}`);
        }
    });

    // Handle marking articles as read
    ipcMain.handle('mark-as-read', async (event, { id }) => {
        try {
            const stmt = db.prepare('UPDATE articles SET read = 1 WHERE id = ?');
            const result = stmt.run(id);
            return { success: true, changes: result.changes };
        } catch (err) {
            console.error('Error marking article as read:', err);
            throw err;
        }
    });

    // Handle deleting feeds
    ipcMain.handle('delete-feed', async (event, { id }) => {
        try {
            // Use a transaction for atomic deletion
            const transaction = db.transaction(() => {
                // First get the feed info (optional, for logging)
                const feedStmt = db.prepare('SELECT url FROM feeds WHERE id = ?');
                const feed = feedStmt.get(id);
                
                // Delete articles first (due to foreign key constraint)
                const deleteArticlesStmt = db.prepare('DELETE FROM articles WHERE feedId = ?');
                deleteArticlesStmt.run(id);
                
                // Then delete the feed
                const deleteFeedStmt = db.prepare('DELETE FROM feeds WHERE id = ?');
                deleteFeedStmt.run(id);
                
                return feed;
            });
            
            transaction();
            
            return { 
                success: true, 
                message: 'Feed removed successfully' 
            };
        } catch (err) {
            console.error('Error deleting feed:', err);
            throw err;
        }
    });

    // Handle updating all feeds
    ipcMain.handle('update-feeds', async () => {
        try {
            // Get all feeds from database
            const feedsStmt = db.prepare('SELECT * FROM feeds');
            const feeds = feedsStmt.all();
            
            if (feeds.length === 0) {
                return {
                    success: true,
                    message: 'No feeds to update',
                    updatedFeeds: 0,
                    newArticles: 0
                };
            }
            
            let updatedFeeds = 0;
            let totalNewArticles = 0;
            
            // Prepare the article insert statement
            const insertArticleStmt = db.prepare(`
                INSERT OR IGNORE INTO articles (
                    title, link, publishedAt, feedId, imageUrl, author, description
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            
            // Update each feed with improved error handling
            for (const feed of feeds) {
                try {
                    const feedData = await parser.parseURL(feed.url);
                    let newArticlesCount = 0;
                    
                    // Process articles in batches
                    const batchSize = 10;
                    const articles = feedData.items || [];
                    
                    for (let i = 0; i < articles.length; i += batchSize) {
                        const batch = articles.slice(i, i + batchSize);
                        
                        // Use transaction for batch processing
                        const transaction = db.transaction(() => {
                            for (const item of batch) {
                                const imageUrl = extractImageUrl(item, feedData);
                                
                                // Get author and description
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
                                        .replace(/<[^>]*>/g, ' ')
                                        .replace(/&\w+;/g, '')
                                        .replace(/&#\d+;/g, '')
                                        .replace(/\s+/g, ' ')
                                        .replace(/[^\w\s.,!?-]/g, '')
                                        .trim();
                                    
                                    description = description.substring(0, 200) + (description.length > 200 ? '...' : '');
                                }
                                
                                try {
                                    const result = insertArticleStmt.run(
                                        item.title,
                                        item.link,
                                        new Date(item.pubDate).toISOString(),
                                        feed.id,
                                        imageUrl,
                                        author,
                                        description
                                    );
                                    
                                    if (result.changes > 0) {
                                        newArticlesCount++;
                                    }
                                } catch (err) {
                                    // Silently continue on individual article errors
                                }
                            }
                        });
                        
                        transaction();
                    }
                    
                    updatedFeeds++;
                    totalNewArticles += newArticlesCount;
                    
                } catch (err) {
                    console.error(`Error updating feed ${feed.url}:`, err);
                }
            }
            
            return {
                success: true,
                updatedFeeds,
                newArticles: totalNewArticles,
                message: `Updated ${updatedFeeds} feeds with ${totalNewArticles} new articles`
            };
            
        } catch (err) {
            console.error('Error updating feeds:', err);
            return {
                success: false,
                error: err.message
            };
        }
    });

    // Handle database cleanup
    ipcMain.handle('cleanup-database', async (event, { retentionDays }) => {
        try {
            console.log(`Cleaning up articles older than ${retentionDays} days`);
            
            // Calculate the cutoff date
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
            const cutoffISO = cutoffDate.toISOString();
            
            console.log('Cutoff date:', cutoffISO);
            
            // Delete old articles
            const deleteStmt = db.prepare('DELETE FROM articles WHERE publishedAt < ?');
            const result = deleteStmt.run(cutoffISO);
            
            console.log(`Deleted ${result.changes} old articles`);
            
            return {
                success: true,
                deletedCount: result.changes,
                cutoffDate: cutoffISO
            };
        } catch (err) {
            console.error('Error cleaning up database:', err);
            return {
                success: false,
                error: err.message
            };
        }
    });

    // Handle popup attempt logging for debugging
    ipcMain.handle('log-popup-attempt', async (event, { method, url, timestamp, stackTrace }) => {
        console.log('\n=== POPUP ATTEMPT DETECTED ===');
        console.log('Method:', method);
        console.log('URL:', url);
        console.log('Timestamp:', timestamp);
        if (stackTrace) {
            console.log('Stack Trace:', stackTrace);
        }
        console.log('==============================\n');
        
        return { success: true };
    });


}

module.exports = { setupIPC };