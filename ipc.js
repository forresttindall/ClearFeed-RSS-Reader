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
    console.log('\nExtracting image for article:', item.title);
    
    let imageUrl = null;
    const sources = [];

    // Try enclosure first (many RSS feeds use this for images)
    if (item.enclosure && item.enclosure.url) {
        sources.push({
            type: 'enclosure',
            raw: item.enclosure
        });
        
        const enclosureType = item.enclosure.type || '';
        if (enclosureType.startsWith('image/')) {
            imageUrl = item.enclosure.url;
            console.log('Found enclosure image:', imageUrl);
            return imageUrl;
        }
    }

    // Try media:thumbnail (Wired and many modern feeds use this)
    if (item['media:thumbnail']) {
        sources.push({
            type: 'media:thumbnail',
            raw: item['media:thumbnail']
        });

        // Handle both single thumbnail and array of thumbnails
        if (Array.isArray(item['media:thumbnail'])) {
            // Sort by width to get the largest thumbnail
            const thumbnails = item['media:thumbnail']
                .filter(t => t.$ && t.$.url && t.$.width)
                .sort((a, b) => parseInt(b.$.width) - parseInt(a.$.width));
            
            if (thumbnails.length > 0) {
                imageUrl = thumbnails[0].$.url;
                console.log('Found largest media:thumbnail:', imageUrl, 'width:', thumbnails[0].$.width);
                return imageUrl;
            }
        } else if (item['media:thumbnail'].$ && item['media:thumbnail'].$.url) {
            imageUrl = item['media:thumbnail'].$.url;
            console.log('Found media:thumbnail:', imageUrl);
            return imageUrl;
        }
    }

    // Try media:content as fallback
    if (!imageUrl && item['media:content']) {
        sources.push({
            type: 'media:content',
            raw: item['media:content']
        });
        
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
                imageUrl = mediaContent[0].$.url;
                console.log('Found largest media:content image:', imageUrl);
                return imageUrl;
            }
        } else if (item['media:content'].$ && item['media:content'].$.url) {
            imageUrl = item['media:content'].$.url;
            console.log('Found media:content image:', imageUrl);
            return imageUrl;
        }
    }

    // Try content/description with improved regex patterns
    if (!imageUrl && (item.content || item.description)) {
        const content = item.content || item.description;
        sources.push({
            type: 'content',
            raw: 'content/description available'
        });
        
        // Try multiple image patterns
        const imgPatterns = [
            /<img[^>]+src=["']([^"'>]+)["'][^>]*>/gi,
            /<img[^>]+src=([^\s>]+)[^>]*>/gi,
            /src=["']([^"'>]*\.(jpg|jpeg|png|gif|webp))["']/gi,
            /https?:\/\/[^\s<>"']*\.(jpg|jpeg|png|gif|webp)/gi
        ];
        
        for (const pattern of imgPatterns) {
            const matches = content.matchAll(pattern);
            for (const match of matches) {
                let url = match[1] || match[0];
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
                    
                    imageUrl = url;
                    console.log('Found content image:', imageUrl);
                    return imageUrl;
                }
            }
        }
    }

    // Try iTunes image (for podcast feeds)
    if (!imageUrl && item['itunes:image']) {
        sources.push({
            type: 'itunes:image',
            raw: item['itunes:image']
        });
        
        if (item['itunes:image'].$ && item['itunes:image'].$.href) {
            imageUrl = item['itunes:image'].$.href;
            console.log('Found iTunes image:', imageUrl);
            return imageUrl;
        }
    }

    // Try feed-level image as last resort
    if (!imageUrl && feedData.image && feedData.image.url) {
        sources.push({
            type: 'feed-image',
            raw: feedData.image
        });
        
        imageUrl = feedData.image.url;
        console.log('Using feed-level image:', imageUrl);
        return imageUrl;
    }

    console.log('No suitable image found. Attempted sources:', sources);
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
        'log-popup-attempt',
        'check-for-updates',
        'download-update',
        'install-update'
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
            
            // Insert the feed
            const insertFeedStmt = db.prepare('INSERT INTO feeds (url) VALUES (?)');
            const feedResult = insertFeedStmt.run(url);
            const feedId = feedResult.lastInsertRowid;
            
            console.log('\n=== Feed Data ===');
            console.log('Title:', feedData.title);
            console.log('Items:', feedData.items.length);

            // Prepare the article insert statement
            const insertArticleStmt = db.prepare(`
                INSERT OR IGNORE INTO articles (
                    title, link, publishedAt, feedId, imageUrl, author, description
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            // Process each article
             for (const item of feedData.items) {
                 console.log('\n=== Processing Article ===');
                 console.log('Title:', item.title);
                 
                 // Log the raw item structure
                 console.log('Raw item structure:', Object.keys(item));
                 
                 // Log specific fields we're interested in
                 if (item['media:content']) {
                     console.log('media:content:', JSON.stringify(item['media:content'], null, 2));
                 }
                 if (item.content) {
                     console.log('Content length:', item.content.length);
                     console.log('Content preview:', item.content.substring(0, 200));
                 }
                 if (item.description) {
                     console.log('Description length:', item.description.length);
                     console.log('Description preview:', item.description.substring(0, 200));
                 }
                 if (item.enclosure) {
                     console.log('Enclosure:', item.enclosure);
                 }

                 const imageUrl = extractImageUrl(item, feedData);
                 console.log('Final image URL:', imageUrl);
                 
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

                 // Add debug logging
                 console.log('Article data:', {
                     title: item.title,
                     imageUrl,
                     author,
                     description: description?.substring(0, 50) + '...'
                 });

                 try {
                     const articleResult = insertArticleStmt.run(
                         item.title,
                         item.link,
                         new Date(item.pubDate).toISOString(),
                         feedId,
                         imageUrl,
                         author,
                         description
                     );
                     
                     console.log('Article inserted:', {
                         id: articleResult.lastInsertRowid,
                         title: item.title,
                         imageUrl: imageUrl,
                         feedId: feedId
                     });
                 } catch (err) {
                     console.error('Database error while inserting article:', err);
                     throw err;
                 }
             }

            return { 
                success: true, 
                feedId,
                feedTitle: feedData.title 
            };
        } catch (error) {
            if (error.message.includes('Status code')) {
                throw new Error('Unable to access this feed. Please check the URL and try again.');
            }
            throw new Error('Invalid RSS feed URL or feed not accessible');
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
            console.log('Starting feed update process...');
            
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
            
            // Update each feed
            for (const feed of feeds) {
                try {
                    console.log(`Updating feed: ${feed.url}`);
                    const feedData = await parser.parseURL(feed.url);
                    
                    let newArticlesCount = 0;
                    
                    // Process each article
                    for (const item of feedData.items) {
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
                            console.error('Error inserting article:', err);
                        }
                    }
                    
                    console.log(`Feed ${feed.url} updated with ${newArticlesCount} new articles`);
                    updatedFeeds++;
                    totalNewArticles += newArticlesCount;
                    
                } catch (err) {
                    console.error(`Error updating feed ${feed.url}:`, err);
                }
            }
            
            console.log(`Feed update complete. Updated ${updatedFeeds} feeds with ${totalNewArticles} new articles`);
            
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

    // Handle checking for updates
    ipcMain.handle('check-for-updates', async () => {
        try {
            const { autoUpdater } = require('electron-updater');
            const isDev = process.env.NODE_ENV === 'development';
            
            if (isDev) {
                return {
                    success: false,
                    error: 'Updates are disabled in development mode'
                };
            }
            
            console.log('Manually checking for updates...');
            const updateCheckResult = await autoUpdater.checkForUpdates();
            
            if (updateCheckResult && updateCheckResult.updateInfo) {
                return {
                    success: true,
                    updateAvailable: true,
                    version: updateCheckResult.updateInfo.version,
                    releaseDate: updateCheckResult.updateInfo.releaseDate
                };
            } else {
                return {
                    success: true,
                    updateAvailable: false,
                    message: 'You are running the latest version'
                };
            }
        } catch (err) {
            console.error('Error checking for updates:', err);
            return {
                success: false,
                error: err.message
            };
        }
    });
    
    // Handle downloading updates
    ipcMain.handle('download-update', async () => {
        try {
            const { autoUpdater } = require('electron-updater');
            const isDev = process.env.NODE_ENV === 'development';
            
            if (isDev) {
                return {
                    success: false,
                    error: 'Updates are disabled in development mode'
                };
            }
            
            console.log('Starting update download...');
            await autoUpdater.downloadUpdate();
            
            return {
                success: true,
                message: 'Update download started'
            };
        } catch (err) {
            console.error('Error downloading update:', err);
            return {
                success: false,
                error: err.message
            };
        }
    });
    
    // Handle installing updates
    ipcMain.handle('install-update', async () => {
        try {
            const { autoUpdater } = require('electron-updater');
            const isDev = process.env.NODE_ENV === 'development';
            
            if (isDev) {
                return {
                    success: false,
                    error: 'Updates are disabled in development mode'
                };
            }
            
            console.log('Installing update and restarting...');
            autoUpdater.quitAndInstall();
            
            return {
                success: true,
                message: 'Installing update...'
            };
        } catch (err) {
            console.error('Error installing update:', err);
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