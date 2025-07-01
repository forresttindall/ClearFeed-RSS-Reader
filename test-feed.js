const RSSParser = require('rss-parser');

const parser = new RSSParser({
    headers: {
        'User-Agent': 'ClearFeed Desktop RSS Reader'
    },
    timeout: 5000,
    requestOptions: {
        rejectUnauthorized: false
    }
});

async function testFeed() {
    try {
        console.log('Testing The Verge RSS feed...');
        const feedData = await parser.parseURL('https://www.theverge.com/rss/index.xml');
        
        console.log('Feed title:', feedData.title);
        console.log('Number of items:', feedData.items.length);
        
        // Check first few items
        feedData.items.slice(0, 3).forEach((item, index) => {
            console.log(`\n=== Item ${index + 1} ===`);
            console.log('Title:', item.title);
            console.log('Available fields:', Object.keys(item));
            
            // Check for image-related fields
            if (item['media:content']) {
                console.log('media:content:', JSON.stringify(item['media:content'], null, 2));
            }
            if (item['media:thumbnail']) {
                console.log('media:thumbnail:', JSON.stringify(item['media:thumbnail'], null, 2));
            }
            if (item.enclosure) {
                console.log('enclosure:', item.enclosure);
            }
            if (item.content) {
                console.log('content length:', item.content.length);
                console.log('content preview:', item.content.substring(0, 500));
                
                // Look for images in content
                const imgMatches = item.content.match(/<img[^>]+src=["']([^"'>]+)["'][^>]*>/gi);
                if (imgMatches) {
                    console.log('Found img tags:', imgMatches.length);
                    imgMatches.slice(0, 3).forEach((match, i) => {
                        const srcMatch = match.match(/src=["']([^"'>]+)["']/i);
                        if (srcMatch) {
                            console.log(`Image ${i + 1}:`, srcMatch[1]);
                        }
                    });
                }
            }
            if (item.description) {
                console.log('description preview:', item.description.substring(0, 200));
            }
        });
        
    } catch (error) {
        console.error('Error testing feed:', error);
    }
}

testFeed();