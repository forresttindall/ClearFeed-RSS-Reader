import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { FixedSizeList as List } from 'react-window';
import { 
  List as ListIcon, 
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
  ArrowLeft,
  GithubLogo
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

// Optimized ArticleImage component with better loading strategies
const ArticleImage = memo(({ article, feedsMap }) => {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef(null);
  
  const getFallbackSrc = useCallback(() => {
    if (!feedsMap || !article) return null;
    
    try {
      const url = article.link || feedsMap[article.feedId];
      const domain = new URL(url).hostname.replace(/^www\./, '');
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
    } catch (e) {
      return null;
    }
  }, [article, feedsMap]);
  
  const handleImageLoad = useCallback(() => {
    setIsLoaded(true);
  }, []);
  
  const handleImageError = useCallback(() => {
    setHasError(true);
  }, []);
  
  // Optimize image URLs for faster loading - be more conservative
  const optimizedImageUrl = useMemo(() => {
    if (!article.imageUrl) return null;
    
    // For common image services, add size parameters for faster loading
    const url = article.imageUrl;
    
    // Only optimize NASA images which we know support size parameters
    if (url.includes('nasa.gov') && url.includes('wp-content/uploads')) {
      return url.includes('?') ? `${url}&w=400` : `${url}?w=400`;
    }
    
    // Return original URL for better compatibility
    return url;
  }, [article.imageUrl]);
  
  // Show placeholder immediately if no image URL or after error
  if (!optimizedImageUrl || hasError) {
    const fallbackSrc = getFallbackSrc();
    
    if (fallbackSrc && !hasError) {
      return (
        <img 
          src={fallbackSrc}
          alt=""
          onError={handleImageError}
          onLoad={handleImageLoad}
          style={{ 
            width: '32px', 
            height: '32px', 
            objectFit: 'contain',
            opacity: isLoaded ? 1 : 0.7,
            transition: 'opacity 0.15s ease'
          }}
        />
      );
    }
    
    return (
      <div className="article-image-placeholder">
        <Newspaper size={32} />
      </div>
    );
  }
  
  return (
    <img 
      ref={imgRef}
      src={optimizedImageUrl}
      alt=""
      onError={handleImageError}
      onLoad={handleImageLoad}
      loading="lazy"
      decoding="async"
      fetchpriority="low"
      style={{
        opacity: isLoaded ? 1 : 0.7,
        transition: 'opacity 0.15s ease',
        maxWidth: '100%',
        height: 'auto'
      }}
    />
  );
});



// Memoized ArticleCard component to prevent unnecessary re-renders
const ArticleCard = memo(({ article, feedsMap, readLater, onArticleClick, onToggleReadLater, formatTimestamp, simplifyUrl }) => (
  <article 
    className={`article-card ${article.read ? 'read' : ''}`}
    onClick={() => onArticleClick(article)}
  >
    <div className="article-image-container">
      <ArticleImage article={article} feedsMap={feedsMap} />
    </div>
    <div className="article-content">
      <div className="article-header">
        <div className="article-meta">
          <h2>
            <a 
              href={article.link} 
              onClick={(e) => {
                e.preventDefault();
                onArticleClick(article);
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
            onToggleReadLater(article.id);
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
));

// Virtualized row component for react-window - optimized for performance
const VirtualizedArticleRow = memo(({ index, style, data }) => {
  const { 
    articles, 
    feedsMap, 
    readLater, 
    onArticleClick, 
    onToggleReadLater, 
    formatTimestamp, 
    simplifyUrl 
  } = data;
  
  const article = articles[index];
  
  if (!article) return null;
  
  return (
    <div style={style} className="virtualized-item">
      <ArticleCard 
        article={article}
        feedsMap={feedsMap}
        readLater={readLater}
        onArticleClick={onArticleClick}
        onToggleReadLater={onToggleReadLater}
        formatTimestamp={formatTimestamp}
        simplifyUrl={simplifyUrl}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better performance
  const prevArticle = prevProps.data.articles[prevProps.index];
  const nextArticle = nextProps.data.articles[nextProps.index];
  
  if (!prevArticle || !nextArticle) return false;
  
  return (
    prevArticle.id === nextArticle.id &&
    prevProps.data.readLater.includes(prevArticle.id) === nextProps.data.readLater.includes(nextArticle.id) &&
    prevProps.style.top === nextProps.style.top &&
    prevProps.style.height === nextProps.style.height
  );
});

function Dashboard() {
  
  const [theme, setTheme] = useState(() => 
    localStorage.getItem('theme') || 'dark'
  );
  const [font, setFont] = useState(() => 
    localStorage.getItem('font') || 'sans'
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
  const [showDatabaseSettings, setShowDatabaseSettings] = useState(false);
  
  // Scroll position tracking for each feed
  const [feedScrollPositions, setFeedScrollPositions] = useState({});
  
  // Ref for the virtualized list
  const listRef = useRef(null);



  // Optimized theme and font handlers
  const handleThemeChange = useCallback(() => {
    const newTheme = theme === 'dark' ? '' : 'dark';
    
    // Apply theme immediately to DOM for instant switching
    document.documentElement.className = newTheme;
    localStorage.setItem('theme', newTheme);
    
    // Update state after DOM change
    setTheme(newTheme);
  }, [theme]);

  const handleFontChange = useCallback(() => {
    const newFont = font === 'mono' ? 'sans' : 'mono';
    
    // Apply font immediately to DOM
    document.documentElement.style.fontFamily = 
      newFont === 'mono' ? "'Geist Mono', monospace" : "'Geist Sans', sans-serif";
    localStorage.setItem('font', newFont);
    
    // Update state after DOM change
    setFont(newFont);
  }, [font]);

  // Remove separate useEffect hooks since we handle DOM updates directly

  // Initialize theme and font on mount
  useEffect(() => {
    // Apply saved theme and font immediately on mount
    document.documentElement.className = theme;
    document.documentElement.style.fontFamily = 
      font === 'mono' ? "'Geist Mono', monospace" : "'Geist Sans', sans-serif";
  }, [theme, font]); // Apply when theme or font changes

  // Click outside to close settings menu
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSettings && !event.target.closest('.settings-dropdown') && !event.target.closest('.icon-button')) {
        setShowSettings(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettings]);

  // Single initialization effect
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const initializeApp = async () => {
      // Wait briefly for electron initialization
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  useEffect(() => {
    localStorage.setItem('retentionDays', retentionDays.toString());
  }, [retentionDays]);



  const fetchFeeds = useCallback(async () => {
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
  }, []);

  const fetchArticles = useCallback(async () => {
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
  }, []);

  const addFeed = useCallback(async () => {
    setShowAddFeedModal(true);
  }, []);

  const handleDatabaseCleanupFromSettings = useCallback(async () => {
    const electronInstance = getElectron();
    if (!electronInstance?.ipcRenderer) {
        console.error('IPC not available');
        return;
    }
    
    if (!window.confirm(`Are you sure you want to delete articles older than ${retentionDays} days? This action cannot be undone.`)) {
        return;
    }
    
    try {
      const result = await electronInstance.ipcRenderer.invoke('cleanup-database', { retentionDays });
      
      if (result.success) {
        // Refresh the UI with updated data
        await fetchArticles();
        
        alert(`Successfully cleaned up! Deleted ${result.deletedCount} old articles.`);
      } else {
        alert('Error during cleanup: ' + result.error);
      }
    } catch (error) {
      console.error('Error during database cleanup:', error);
      alert('Error during cleanup: ' + error.message);
    }
  }, [retentionDays, fetchArticles]);

  const handleAddFeedSubmit = useCallback(async () => {
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
        const result = await electronInstance.ipcRenderer.invoke('add-feed', { url: newFeedUrl });
        
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
  }, [newFeedUrl, fetchFeeds, fetchArticles]);

  const filteredArticles = useMemo(() => {
    if (!articles.length) return [];
    
    let filtered = articles;
    
    // Apply filters in order of selectivity (most selective first)
    if (selectedFeed) {
      filtered = filtered.filter(article => article.feedId === selectedFeed);
    }
    
    if (showReadLater) {
      filtered = filtered.filter(article => readLater.includes(article.id));
    }
    
    if (showUnread) {
      filtered = filtered.filter(article => !article.read);
    }
    
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(article => 
        article.title.toLowerCase().includes(lowerSearchTerm)
      );
    }
    
    // Sort by date (newest first)
    return filtered.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  }, [articles, selectedFeed, searchTerm, showReadLater, readLater, showUnread]);

  // Effect to restore scroll position when articles change (after feed switch)
  useEffect(() => {
    if (filteredArticles.length > 0) {
      const feedKey = selectedFeed || 'all';
      const savedPosition = feedScrollPositions[feedKey];
      
      if (savedPosition !== undefined) {
        // Small delay to ensure the list has rendered
        setTimeout(() => {
          if (listRef.current) {
            listRef.current.scrollTo(savedPosition);
          }
        }, 10);
      }
    }
  }, [filteredArticles.length, selectedFeed, feedScrollPositions]);

  // Function to save current scroll position for the current feed
  const saveCurrentScrollPosition = useCallback(() => {
    if (listRef.current) {
      const currentScrollOffset = listRef.current.state.scrollOffset;
      const feedKey = selectedFeed || 'all'; // Use 'all' for All Feeds
      
      setFeedScrollPositions(prev => ({
        ...prev,
        [feedKey]: currentScrollOffset
      }));
    }
  }, [selectedFeed]);

  // Function to restore scroll position for a feed
  const restoreScrollPosition = useCallback((feedId) => {
    const feedKey = feedId || 'all';
    const savedPosition = feedScrollPositions[feedKey] || 0;
    
    // Use setTimeout to ensure the list has rendered with new data
    setTimeout(() => {
      if (listRef.current) {
        listRef.current.scrollTo(savedPosition);
      }
    }, 0);
  }, [feedScrollPositions]);

  // Enhanced feed selection handler that saves/restores scroll positions
  const handleFeedSelection = useCallback((feedId) => {
    // Save current scroll position before switching
    saveCurrentScrollPosition();
    
    // Switch to new feed
    setSelectedFeed(feedId);
    
    // Restore scroll position for the new feed after a brief delay
    setTimeout(() => {
      restoreScrollPosition(feedId);
    }, 50);
  }, [saveCurrentScrollPosition, restoreScrollPosition]);

  // Function to reset all scroll positions (for refresh)
  const resetScrollPositions = useCallback(() => {
    setFeedScrollPositions({});
    if (listRef.current) {
      listRef.current.scrollTo(0);
    }
  }, []);

  const toggleReadLater = useCallback((articleId) => {
    setReadLater(prev => 
      prev.includes(articleId) 
        ? prev.filter(id => id !== articleId)
        : [...prev, articleId]
    );
  }, []);

  const markAsRead = useCallback(async (articleId) => {
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
  }, []);

  // Add this helper function at the top of your component
  const formatTimestamp = useCallback((dateString) => {
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
  }, []);

  const handleArticleClick = useCallback(async (article) => {
    // Save current scroll position for the current feed before viewing article
    saveCurrentScrollPosition();
    
    await markAsRead(article.id);
    setSelectedArticle(article);
  }, [markAsRead, saveCurrentScrollPosition]);

  // Add this helper function to simplify URLs
  const simplifyUrl = useCallback((url) => {
    try {
      const domain = new URL(url).hostname;
      return domain.replace(/^www\./, '');
    } catch (e) {
      return url;
    }
  }, []);

  // Memoize itemData to prevent unnecessary re-renders of virtualized list
  const itemData = useMemo(() => ({
    articles: filteredArticles,
    feedsMap,
    readLater,
    onArticleClick: handleArticleClick,
    onToggleReadLater: toggleReadLater,
    formatTimestamp,
    simplifyUrl
  }), [filteredArticles, feedsMap, readLater, handleArticleClick, toggleReadLater, formatTimestamp, simplifyUrl]);

  const deleteFeed = useCallback(async (feedId) => {
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
            
            // Clean up scroll position for deleted feed
            setFeedScrollPositions(prev => {
              const newPositions = { ...prev };
              delete newPositions[feedId];
              return newPositions;
            });
            
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
  }, [feedsMap, simplifyUrl, selectedFeed]);


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
        
        // Reset scroll positions to top after refresh
        resetScrollPositions();
        
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

  const handleBackToFeed = () => {
    setSelectedArticle(null);
    
    // Restore scroll position for the current feed
    setTimeout(() => {
      restoreScrollPosition(selectedFeed);
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

  const handleOpenGitHub = () => {
    const electronInstance = getElectron();
    if (electronInstance?.shell?.openExternal) {
      electronInstance.shell.openExternal('https://github.com/forresttindall/ClearFeed-RSS-Reader');
    } else {
      window.open('https://github.com/forresttindall/ClearFeed-RSS-Reader', '_blank');
    }
  };

  const handleOpenDonate = () => {
    const electronInstance = getElectron();
    if (electronInstance?.shell?.openExternal) {
      electronInstance.shell.openExternal('https://venmo.com/ForrestTindall');
    } else {
      window.open('https://venmo.com/ForrestTindall', '_blank');
    }
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
                      onChange={handleThemeChange}
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
                      onChange={handleFontChange}
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
                
                <button 
                  onClick={() => {
                    const electronInstance = window.electronInstance || window.electron;
                    if (electronInstance && electronInstance.shell) {
                      electronInstance.shell.openExternal('mailto:Forrest@creationbase.io?subject=ClearFeed Bug Report');
                    } else {
                      window.open('mailto:Forrest@creationbase.io?subject=ClearFeed Bug Report', '_blank');
                    }
                  }}
                  className="bug-report-button"
                >
                  Report a Bug
                </button>
                
                <div className="settings-divider"></div>
                
                <button 
                  onClick={handleOpenGitHub}
                  className="github-button"
                >
                  <GithubLogo size={16} />
                  GitHub
                </button>
                
                <button 
                  onClick={handleOpenDonate}
                  className="donate-button"
                >
                  Donate
                </button>
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
                    onClick={() => handleFeedSelection(null)}
                  >
                    <Newspaper size={18} weight="regular" />
                    <span>All Feeds</span>
                  </button>
                  {feeds.map(feed => (
                    <div key={feed.id} className="feed-item-container">
                      <button
                        className={`feed-item ${selectedFeed === feed.id ? 'active' : ''}`}
                        onClick={() => handleFeedSelection(feed.id)}
                      >
                        <ListIcon size={18} />
                        <span className="feed-title">{simplifyUrl(feed.url)}</span>
                      </button>
                      <div className="feed-actions">
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
                            
                            // Inject CSS to fix scrollbar styling
                            try {
                                const iframe = e.target;
                                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                                
                                // Create style element for scrollbar
                                const style = iframeDoc.createElement('style');
                                style.textContent = `
                                    /* Theme-aware scrollbar for iframe content */
                                    ::-webkit-scrollbar {
                                        width: 10px;
                                        height: 10px;
                                    }
                                    
                                    ::-webkit-scrollbar-track {
                                        background: ${theme === 'dark' ? '#1a1a1a' : '#f5f5f5'};
                                    }
                                    
                                    ::-webkit-scrollbar-thumb {
                                        background: ${theme === 'dark' ? '#363636' : '#cccccc'};
                                        border-radius: 5px;
                                    }
                                    
                                    ::-webkit-scrollbar-thumb:hover {
                                        background: ${theme === 'dark' ? '#444444' : '#999999'};
                                    }
                                    
                                    /* Firefox scrollbar */
                                    * {
                                        scrollbar-width: thin;
                                        scrollbar-color: ${theme === 'dark' ? '#363636 #1a1a1a' : '#cccccc #f5f5f5'};
                                    }
                                `;
                                
                                iframeDoc.head.appendChild(style);
                            } catch (err) {
                                // Cross-origin iframe, can't inject styles
                                console.log('Cannot inject styles into cross-origin iframe');
                            }
                        }}
                    />
                </div>
            ) : (
                filteredArticles.length > 0 ? (
                    <div className="articles-list">
                        <List
                            ref={listRef}
                            height={window.innerHeight - 120} // Adjust based on your header height
                            width="100%"
                            itemCount={filteredArticles.length}
                            itemSize={196}
                            itemData={itemData}
                        >
                            {VirtualizedArticleRow}
                        </List>
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
              onKeyDown={(e) => {
                // Submit on Enter
                if (e.key === 'Enter') {
                  handleAddFeedSubmit();
                }
              }}
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

      {showDatabaseSettings && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Database Settings</h2>
            <div className="settings-section">
              <label htmlFor="retention-days">Delete articles older than:</label>
              <input
                id="retention-days"
                type="number"
                min="1"
                max="365"
                value={retentionDays}
                onChange={(e) => setRetentionDays(parseInt(e.target.value) || 30)}
              />
              <span>days</span>
            </div>
            <div className="modal-buttons">
              <button onClick={handleDatabaseCleanupFromSettings} className="cleanup-button">
                Clean Up Database
              </button>
              <button onClick={() => setShowDatabaseSettings(false)} className="cancel-button">
                Close
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