import { useState, useEffect } from 'react';
import { 
  List, 
  EyeSlash, 
  Bookmark, 
  MagnifyingGlass, 
  Plus,
  Newspaper,
  CaretDown,
  CaretRight,
  Trash,
  Gear,
  ArrowsClockwise,
  ArrowLeft
} from 'phosphor-react';
import '../styles/Dashboard.css';



// Near the top of the file
const getElectron = () => {
    if (typeof window !== 'undefined' && window.electron) {
        return window.electron;
    }
    console.error('Electron not available');
    return null;
};



function Dashboard() {
  
  const [theme, setTheme] = useState(() => 
    localStorage.getItem('theme') || 'dark'
  );
  const [font, setFont] = useState(() => 
    localStorage.getItem('font') || 'mono'
  );
  const [feeds, setFeeds] = useState([]);
  const [articles, setArticles] = useState([]);
  const [selectedFeed, setSelectedFeed] = useState(null);
  const [readLater, setReadLater] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showReadLater, setShowReadLater] = useState(false);
  const [showUnread, setShowUnread] = useState(false);
  const [feedsMap, setFeedsMap] = useState({});
  const [feedsCollapsed, setFeedsCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddFeedModal, setShowAddFeedModal] = useState(false);
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [selectedArticle, setSelectedArticle] = useState(null);
  const [retentionDays, setRetentionDays] = useState(() => 
    parseInt(localStorage.getItem('retentionDays')) || 30
  );
  const [savedScrollPosition, setSavedScrollPosition] = useState(0);

  // Fetch feeds on component mount
  useEffect(() => {
    
    const initializeApp = async () => {
        // Wait a bit to ensure electron is initialized
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const electronInstance = getElectron();
        if (!electronInstance) {
            console.error('Electron not available after initialization');
            return;
        }

        try {
            await fetchFeeds();
            await fetchArticles();
        } catch (error) {
            console.error('Error initializing app:', error);
        }
    };

    initializeApp();
  }, []);

  // Update localStorage when preferences change
  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('font', font);
  }, [font]);

  useEffect(() => {
    localStorage.setItem('retentionDays', retentionDays.toString());
  }, [retentionDays]);

  // Apply mono font to the entire document
  useEffect(() => {
    document.documentElement.style.fontFamily = 
      font === 'mono' ? "'Geist Mono', monospace" : "'Geist Sans', sans-serif";
  }, [font]);



  // Also add this useEffect to set the initial theme on body
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.className = savedTheme;
    console.log('Theme initialized:', savedTheme);
  }, []);

  const fetchFeeds = async () => {
    const electronInstance = getElectron();
    if (!electronInstance?.ipcRenderer) {
        throw new Error('IPC not available');
    }
    
    try {
      const feeds = await electronInstance.ipcRenderer.invoke('fetch-feeds');
      setFeeds(feeds);
      
      const feedMapping = {};
      feeds.forEach(feed => {
        feedMapping[feed.id] = feed.url;
      });
      setFeedsMap(feedMapping);
    } catch (error) {
      console.error('Error fetching feeds:', error);
    }
  };

  const fetchArticles = async () => {
    const electronInstance = getElectron();
    if (!electronInstance?.ipcRenderer) {
        throw new Error('IPC not available');
    }
    
    try {
      const articles = await electronInstance.ipcRenderer.invoke('fetch-articles');
      setArticles(articles);
    } catch (error) {
      console.error('Error fetching articles:', error);
    }
  };

  const addFeed = async () => {
    console.log('Add feed clicked');
    setShowAddFeedModal(true);
  };

  const handleAddFeedSubmit = async () => {
    const electronInstance = getElectron();
    if (!electronInstance) {
        console.error('No electron object found');
        alert('Error: Application not properly initialized. Please restart.');
        return;
    }

    if (!electronInstance.ipcRenderer) {
        console.error('No IPC renderer found');
        alert('Error: IPC not available. Please restart the application.');
        return;
    }

    if (!newFeedUrl) return;

    try {
        console.log('Attempting to add feed:', newFeedUrl);
        const result = await electronInstance.ipcRenderer.invoke('add-feed', { url: newFeedUrl });
        console.log('Add feed result:', result);
        
        if (result.success) {
            await fetchFeeds();
            await fetchArticles();
            setShowAddFeedModal(false);
            setNewFeedUrl('');
            // Show success message
            alert(`Successfully added: ${result.feedTitle}`);
        } else {
            // Show specific error message
            alert(result.error || 'Error adding feed');
        }
    } catch (error) {
        console.error('Error adding feed:', error);
        alert(error.message);
    }
  };

  const filteredArticles = articles
    .filter(article => {
      // Filter by feed
      if (selectedFeed && article.feedId !== selectedFeed) return false;
      
      // Filter by search term
      if (searchTerm && !article.title.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      
      // Filter by read later
      if (showReadLater && !readLater.includes(article.id)) return false;
      
      // Filter by unread
      if (showUnread && article.read) {
        console.log('Filtering out read article:', article.id);
        return false;
      }
      
      return true;
    })
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

  const toggleReadLater = (articleId) => {
    setReadLater(prev => 
      prev.includes(articleId) 
        ? prev.filter(id => id !== articleId)
        : [...prev, articleId]
    );
  };

  // Add this helper function to simplify URLs
  const simplifyUrl = (url) => {
    try {
      const domain = new URL(url).hostname;
      return domain.replace(/^www\./, '');
    } catch (e) {
      return url;
    }
  };

  const markAsRead = async (articleId) => {
    const electronInstance = getElectron();
    if (!electronInstance?.ipcRenderer) {
        console.error('IPC not available');
        return;
    }
    
    try {
      const result = await electronInstance.ipcRenderer.invoke('mark-as-read', { id: articleId });
      if (result.success) {
        setArticles(prevArticles => {
          return prevArticles.map(article => 
            article.id === articleId 
              ? { ...article, read: true }
              : article
          );
        });
      }
    } catch (error) {
      console.error('Error marking article as read:', error);
    }
  };

  const deleteFeed = async (feedId) => {
    const electronInstance = getElectron();
    if (!electronInstance?.ipcRenderer) {
        alert('Error: IPC not available. Please restart the application.');
        return;
    }
    
    const feedName = feedsMap[feedId] ? simplifyUrl(feedsMap[feedId]) : 'this feed';
    if (!window.confirm(`Are you sure you want to remove ${feedName}? All articles from this feed will also be removed.`)) {
        return;
    }

    try {
        const result = await electronInstance.ipcRenderer.invoke('delete-feed', { id: feedId });
        if (result.success) {
            setFeeds(prevFeeds => prevFeeds.filter(feed => feed.id !== feedId));
            setArticles(prevArticles => prevArticles.filter(article => article.feedId !== feedId));
            if (selectedFeed === feedId) {
                setSelectedFeed(null);
            }
            // Show success message
            alert(result.message);
        }
    } catch (error) {
        console.error('Error deleting feed:', error);
        alert('Error removing feed: ' + error.message);
    }
  };

  // Add this useEffect to handle feed updates
  useEffect(() => {
    fetchFeeds();
    fetchArticles();
  }, []); // Only run on mount

  // Add this helper function at the top of your component
  const formatTimestamp = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = (now - date) / 1000; // difference in seconds

    // Less than 1 hour
    if (diff < 3600) {
      const minutes = Math.floor(diff / 60);
      return `${minutes}m ago`;
    }
    // Less than 24 hours
    else if (diff < 86400) {
      const hours = Math.floor(diff / 3600);
      return `${hours}h ago`;
    }
    // Less than 7 days
    else if (diff < 604800) {
      const days = Math.floor(diff / 86400);
      return `${days}d ago`;
    }
    // Otherwise return the date and time
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };


  const handleRefresh = async () => {
    const electronInstance = getElectron();
    if (!electronInstance?.ipcRenderer) {
        console.error('IPC not available');
        return;
    }
    
    try {
      console.log('Updating feeds...');
      const result = await electronInstance.ipcRenderer.invoke('update-feeds');
      
      if (result.success) {
        console.log('Feed update result:', result.message);
        // Refresh the UI with updated data
        await fetchFeeds();
        await fetchArticles();
        
        // Show success message if there were new articles
        if (result.newArticles > 0) {
          alert(`Successfully updated! Found ${result.newArticles} new articles from ${result.updatedFeeds} feeds.`);
        } else {
          alert('Feeds updated - no new articles found.');
        }
      } else {
        console.error('Feed update failed:', result.error);
        alert('Error updating feeds: ' + result.error);
      }
    } catch (error) {
      console.error('Error refreshing feeds:', error);
      alert('Error updating feeds: ' + error.message);
    }
  };

  const handleArticleClick = async (article) => {
    // Save current scroll position before navigating to article
    const feedContentElement = document.querySelector('.feed-content');
    if (feedContentElement) {
      setSavedScrollPosition(feedContentElement.scrollTop);
    }
    
    await markAsRead(article.id);
    setSelectedArticle(article);
  };

  const handleBackToFeed = () => {
    setSelectedArticle(null);
    
    // Restore scroll position after the component re-renders
    setTimeout(() => {
      const feedContentElement = document.querySelector('.feed-content');
      if (feedContentElement) {
        feedContentElement.scrollTop = savedScrollPosition;
      }
    }, 0);
  };

  const handleDatabaseCleanup = async () => {
    const electronInstance = getElectron();
    if (!electronInstance?.ipcRenderer) {
        alert('Error: IPC not available. Please restart the application.');
        return;
    }

    try {
        const result = await electronInstance.ipcRenderer.invoke('cleanup-database', { retentionDays });
        if (result.success) {
            alert(`Database cleaned up. Removed ${result.deletedCount} old articles.`);
            await fetchArticles();
        } else {
            alert(result.error || 'Error cleaning up database');
        }
    } catch (error) {
        console.error('Error cleaning up database:', error);
        alert(error.message);
    }
  };

  const handleRetentionChange = (days) => {
    setRetentionDays(days);
  };

  return (
    <div className={`dashboard ${font}`}>
      <div className="dashboard-wrapper">
        <nav className="navbar">
          <h1>ClearFeed</h1>
          <div className="nav-controls">
            {selectedArticle ? (
                <button 
                    className="icon-button"
                    onClick={handleBackToFeed}
                    title="Back to feeds"
                >
                    <ArrowLeft size={24} />
                </button>
            ) : (
                <button 
                    className="icon-button"
                    onClick={handleRefresh}
                    title="Refresh"
                >
                    <ArrowsClockwise size={24} />
                </button>
            )}
            <button 
              className="icon-button"
              onClick={() => setShowSettings(!showSettings)}
              title="Settings"
            >
              <Gear size={24} />
            </button>
            {showSettings && (
              <div className="settings-dropdown">
                <div className="settings-group">
                  <span>Theme</span>
                  <label className="switch">
                    <input 
                      type="checkbox" 
                      checked={theme === 'dark'}
                      onChange={() => {
                        const newTheme = theme === 'dark' ? '' : 'dark';
                        setTheme(newTheme);
                        localStorage.setItem('theme', newTheme);
                        document.documentElement.classList.toggle('dark');
                      }}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
                
                <div className="settings-group">
                  <span>Mono</span>
                  <label className="switch">
                    <input 
                      type="checkbox" 
                      checked={font === 'mono'}
                      onChange={() => setFont(font === 'mono' ? 'sans' : 'mono')}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
                
                <div className="settings-divider"></div>
                
                <div className="settings-group">
                  <span>Article Retention</span>
                  <select 
                    value={retentionDays}
                    onChange={(e) => handleRetentionChange(parseInt(e.target.value))}
                    className="retention-select"
                  >
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </div>
                
                <button 
                  onClick={handleDatabaseCleanup}
                  className="cleanup-button"
                >
                  Clean Database
                </button>
                
                <div className="settings-divider"></div>
                
                <a 
                  href="https://venmo.com/ForrestTindall" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="donate-button"
                >
                  Donate
                </a>
              </div>
            )}
          </div>
        </nav>
        
        <main className="feed-container">
          <aside className="feed-list">
            <div className="feed-controls">
              <div className="search-wrapper">
                <MagnifyingGlass className="search-icon" size={18} />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search articles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              <button 
                className="add-feed-btn"
                onClick={addFeed}
              >
                <Plus size={18} />
                <span>Add Feed</span>
              </button>

              <div className="filter-buttons">
                <button
                  className={`filter-btn ${showUnread ? 'active' : ''}`}
                  onClick={() => setShowUnread(!showUnread)}
                >
                  <EyeSlash size={18} />
                  <span>Unread</span>
                </button>
                <button
                  className={`filter-btn ${showReadLater ? 'active' : ''}`}
                  onClick={() => setShowReadLater(!showReadLater)}
                >
                  <Bookmark size={18} />
                  <span>Saved</span>
                </button>
              </div>

              <div className="feeds-section">
                <button 
                  className="feeds-header"
                  onClick={() => setFeedsCollapsed(!feedsCollapsed)}
                >
                  {feedsCollapsed ? <CaretRight size={18} /> : <CaretDown size={18} />}
                  <span>Feeds</span>
                  <span className="feed-count">{feeds.length}</span>
                </button>

                <div className={`feeds ${feedsCollapsed ? 'collapsed' : ''}`}>
                  <button 
                    className={`feed-item ${selectedFeed === null ? 'active' : ''}`}
                    onClick={() => setSelectedFeed(null)}
                  >
                    <Newspaper size={18} weight="regular" />
                    <span>All Feeds</span>
                  </button>
                  {feeds.map(feed => (
                    <div key={feed.id} className="feed-item-container">
                      <button
                        className={`feed-item ${selectedFeed === feed.id ? 'active' : ''}`}
                        onClick={() => setSelectedFeed(feed.id)}
                      >
                        <List size={18} />
                        <span>{simplifyUrl(feed.url)}</span>
                      </button>
                      <button 
                        className="delete-feed-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFeed(feed.id);
                        }}
                        title="Delete feed"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
          
          <section className="feed-content">
            {selectedArticle ? (
                <div className="article-viewer">
                    <div className="article-viewer-header">
                        <h1>{selectedArticle.title}</h1>
                        {feedsMap[selectedArticle.feedId] && (
                            <div className="article-source">
                                From {simplifyUrl(feedsMap[selectedArticle.feedId])}
                            </div>
                        )}
                    </div>
                    <iframe
                        src={selectedArticle.link}
                        title={selectedArticle.title}
                        className="article-frame"
                        onError={() => {
                            console.log('Iframe failed to load, opening in external browser');
                            window.electron?.shell?.openExternal(selectedArticle.link);
                            handleBackToFeed();
                        }}
                        onLoad={(e) => {
                            console.log('Iframe loaded successfully for:', selectedArticle.link);
                        }}
                    />
                </div>
            ) : (
                filteredArticles.length > 0 ? (
                    <div className="articles-list">
                        {filteredArticles.map((article) => (
                            <article 
                                key={article.id} 
                                className={`article-card ${article.read ? 'read' : ''}`}
                                onClick={() => handleArticleClick(article)}
                            >
                                <div className="article-image-container">
                                    {article.imageUrl ? (
                                        <img 
                                            src={article.imageUrl} 
                                            alt=""
                                            onError={(e) => {
                                                console.error('Image failed to load:', article.imageUrl);
                                                console.error('Article data:', article);
                                                e.target.parentElement.innerHTML = `
                                                    <div class="article-image-placeholder">
                                                        <Newspaper size={32} />
                                                    </div>
                                                `;
                                            }}
                                            onLoad={() => console.log('Image loaded successfully:', article.imageUrl)}
                                        />
                                    ) : (
                                        <div className="article-image-placeholder">
                                            <Newspaper size={32} />
                                        </div>
                                    )}
                                </div>
                                <div className="article-content">
                                    <div className="article-header">
                                        <div className="article-meta">
                                            <h2>
                                                <a 
                                                    href={article.link} 
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        handleArticleClick(article);
                                                    }}
                                                >
                                                    {article.title}
                                                </a>
                                            </h2>
                                            
                                            {article.description && (
                                                <p className="article-description">
                                                    {article.description}
                                                </p>
                                            )}
                                            
                                            <div className="article-info">
                                                {feedsMap[article.feedId] && (
                                                    <span className="article-source">
                                                        {simplifyUrl(feedsMap[article.feedId])}
                                                    </span>
                                                )}
                                                {article.author && (
                                                    <span className="article-author">
                                                        • {article.author}
                                                    </span>
                                                )}
                                                <span className="article-date">
                                                    • {formatTimestamp(article.publishedAt)}
                                                </span>
                                            </div>
                                        </div>
                                        <button 
                                            className={`save-btn ${readLater.includes(article.id) ? 'active' : ''}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleReadLater(article.id);
                                            }}
                                            title={readLater.includes(article.id) ? 'Saved' : 'Save for later'}
                                        >
                                            <Bookmark 
                                                size={20}
                                                weight={readLater.includes(article.id) ? "fill" : "regular"}
                                            />
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        {feeds.length === 0 ? 'Add your first RSS feed to get started' : 'No articles found'}
                    </div>
                )
            )}
          </section>
        </main>
      </div>
      {showAddFeedModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Add RSS Feed</h2>
            <input
              type="text"
              value={newFeedUrl}
              onChange={(e) => setNewFeedUrl(e.target.value)}
              placeholder="Enter RSS feed URL"
              className="feed-input"
            />
            <div className="modal-buttons">
              <button 
                onClick={() => {
                  setShowAddFeedModal(false);
                  setNewFeedUrl('');
                }}
                className="cancel-button"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddFeedSubmit}
                className="submit-button"
              >
                Add Feed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

console.log('Dashboard component defined and exported');

export default Dashboard;