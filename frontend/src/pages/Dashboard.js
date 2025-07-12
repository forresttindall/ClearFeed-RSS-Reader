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

// Component for handling article images with fallbacks
const ArticleImage = ({ article, feedsMap }) => {
  const [currentImageSrc, setCurrentImageSrc] = useState(article.imageUrl);
  const [imageAttempts, setImageAttempts] = useState(0);
  
  const getFallbackImages = (article, feedsMap) => {
    const fallbacks = [];
    
    if (article.imageUrl) {
      fallbacks.push(article.imageUrl);
    }
    
    // Try to get domain from article link or feed URL
    let domain = null;
    try {
      if (article.link) {
        domain = new URL(article.link).hostname;
      } else if (feedsMap[article.feedId]) {
        domain = new URL(feedsMap[article.feedId]).hostname;
      }
    } catch (e) {
      console.log('Could not parse domain for fallback images:', e);
    }
    
    if (domain) {
      console.log('Trying fallback images for domain:', domain);
      
      // Clean domain (remove www. prefix for better matching)
      const cleanDomain = domain.replace(/^www\./, '');
      
      // Site-specific image handling for major news outlets
      if (cleanDomain.includes('wired.com')) {
        fallbacks.push('https://www.wired.com/wp-content/themes/wired/assets/images/wired-logo.svg');
        fallbacks.push('https://www.wired.com/wp-content/themes/wired/assets/images/wired-logo.png');
        fallbacks.push('https://www.wired.com/favicon.ico');
      } else if (cleanDomain.includes('bloomberg.com')) {
        fallbacks.push('https://assets.bwbx.io/images/users/iqjWHBFdfxIU/iKIWgaiJUtss/v2/pidjEfPlU1QWZop3vfGKsrX.ke8XuWirGYh1PKgEw44kE/200x200.png');
        fallbacks.push('https://www.bloomberg.com/favicon.ico');
      } else if (cleanDomain.includes('yahoo.com')) {
        fallbacks.push('https://s.yimg.com/cv/apiv2/social/images/yahoo_default_logo.png');
        fallbacks.push('https://www.yahoo.com/favicon.ico');
      } else if (cleanDomain.includes('cnn.com')) {
        fallbacks.push('https://cdn.cnn.com/cnn/.e/img/3.0/global/misc/cnn-logo.png');
      } else if (cleanDomain.includes('bbc.com') || cleanDomain.includes('bbc.co.uk')) {
        fallbacks.push('https://static.files.bbci.co.uk/ws/simorgh-assets/public/news/images/metadata/poster-1024x576.png');
      } else if (cleanDomain.includes('reuters.com')) {
        fallbacks.push('https://www.reuters.com/pf/resources/images/reuters/reuters-default.png');
      } else if (cleanDomain.includes('techcrunch.com')) {
        fallbacks.push('https://techcrunch.com/wp-content/uploads/2015/02/cropped-cropped-favicon-gradient.png');
      }
      
      // High-resolution favicon services (try both original and clean domain)
      fallbacks.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
      fallbacks.push(`https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=128`);
      fallbacks.push(`https://icons.duckduckgo.com/ip3/${domain}.ico`);
      fallbacks.push(`https://icons.duckduckgo.com/ip3/${cleanDomain}.ico`);
      
      // Try both original and clean domain for all paths
      const domains = [domain, cleanDomain];
      
      domains.forEach(d => {
        // Apple touch icons (high resolution)
        fallbacks.push(`https://${d}/apple-touch-icon-180x180.png`);
        fallbacks.push(`https://${d}/apple-touch-icon.png`);
        fallbacks.push(`https://${d}/apple-touch-icon-precomposed.png`);
        
        // Standard favicons
        fallbacks.push(`https://${d}/favicon.ico`);
        fallbacks.push(`https://${d}/favicon.png`);
        
        // Social share images (Open Graph)
        fallbacks.push(`https://${d}/og-image.png`);
        fallbacks.push(`https://${d}/og-image.jpg`);
        fallbacks.push(`https://${d}/images/og-image.png`);
        fallbacks.push(`https://${d}/assets/images/og-image.png`);
        
        // Twitter card images
        fallbacks.push(`https://${d}/twitter-card.png`);
        fallbacks.push(`https://${d}/twitter-card.jpg`);
        
        // Common logo paths
        fallbacks.push(`https://${d}/logo.png`);
        fallbacks.push(`https://${d}/logo.svg`);
        fallbacks.push(`https://${d}/assets/logo.png`);
        fallbacks.push(`https://${d}/images/logo.png`);
        fallbacks.push(`https://${d}/static/logo.png`);
        fallbacks.push(`https://${d}/img/logo.png`);
      });
    }
    
    return fallbacks;
  };
  
  const handleImageError = () => {
    const fallbacks = getFallbackImages(article, feedsMap);
    const nextAttempt = imageAttempts + 1;
    
    if (nextAttempt < fallbacks.length) {
      setCurrentImageSrc(fallbacks[nextAttempt]);
      setImageAttempts(nextAttempt);
    } else {
      // All fallbacks failed, show placeholder
      setCurrentImageSrc(null);
    }
  };
  
  if (!currentImageSrc) {
    return (
      <div className="article-image-placeholder">
        <Newspaper size={32} />
      </div>
    );
  }
  
  return (
    <img 
      src={currentImageSrc}
      alt=""
      onError={handleImageError}
      onLoad={() => console.log('Image loaded successfully:', currentImageSrc)}
    />
  );
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
  const [showDatabaseSettings, setShowDatabaseSettings] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [temporaryButtonText, setTemporaryButtonText] = useState(null);



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

  const handleDatabaseCleanupFromSettings = async () => {
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
        console.log('Database cleanup result:', result);
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

  const handleCheckForUpdates = async () => {
    const electronInstance = getElectron();
    if (!electronInstance?.ipcRenderer) {
      console.error('IPC not available');
      setUpdateStatus('Error: IPC not available');
      return;
    }

    setIsCheckingForUpdates(true);
    setUpdateStatus('Checking for updates...');

    try {
      const result = await electronInstance.ipcRenderer.invoke('check-for-updates');
      
      if (result.success) {
        if (result.updateAvailable) {
          setUpdateAvailable(true);
          setUpdateInfo(result);
          setUpdateStatus(`Update available: v${result.version}`);
        } else {
          setUpdateAvailable(false);
          setUpdateStatus(null); // Don't show status for latest version
          setTemporaryButtonText('You are running the latest version');
          
          // Clear the temporary text after 5 seconds
          setTimeout(() => {
            setTemporaryButtonText(null);
          }, 5000);
        }
      } else {
        setUpdateStatus(`Error: ${result.error}`);
      }
    } catch (err) {
      console.error('Error checking for updates:', err);
      setUpdateStatus('Error checking for updates');
    } finally {
      setIsCheckingForUpdates(false);
    }
  };

  const handleDownloadUpdate = async () => {
    const electronInstance = getElectron();
    if (!electronInstance?.ipcRenderer) {
      console.error('IPC not available');
      return;
    }

    setUpdateStatus('Downloading update...');

    try {
      const result = await electronInstance.ipcRenderer.invoke('download-update');
      
      if (result.success) {
        setUpdateStatus('Update downloaded. Ready to install.');
      } else {
        setUpdateStatus(`Download error: ${result.error}`);
      }
    } catch (err) {
      console.error('Error downloading update:', err);
      setUpdateStatus('Error downloading update');
    }
  };

  const handleInstallUpdate = async () => {
    const electronInstance = getElectron();
    if (!electronInstance?.ipcRenderer) {
      console.error('IPC not available');
      return;
    }

    if (!window.confirm('The application will restart to install the update. Continue?')) {
      return;
    }

    setUpdateStatus('Installing update...');

    try {
      await electronInstance.ipcRenderer.invoke('install-update');
    } catch (err) {
      console.error('Error installing update:', err);
      setUpdateStatus('Error installing update');
    }
  };

  const clearUpdateStatus = () => {
    setUpdateStatus(null);
    setUpdateAvailable(false);
    setUpdateInfo(null);
    setTemporaryButtonText(null);
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
                
                <div className="update-section">
                  <h4>Software Updates</h4>
                  <button 
                    onClick={handleCheckForUpdates}
                    className="update-button"
                    disabled={isCheckingForUpdates}
                  >
                    {temporaryButtonText || (isCheckingForUpdates ? 'Checking...' : 'Check for Updates')}
                  </button>
                  
                  {updateStatus && !updateStatus.includes('You are running the latest version') && (
                    <div className="update-status">
                      <span className="update-status-text">{updateStatus}</span>
                      {updateStatus.includes('Error') && (
                        <button 
                          onClick={clearUpdateStatus}
                          className="clear-status-button"
                          title="Clear status"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )}
                  
                  {updateAvailable && updateStatus && updateStatus.includes('Update available') && (
                    <button 
                      onClick={handleDownloadUpdate}
                      className="update-button download-button"
                    >
                      Download Update
                    </button>
                  )}
                  
                  {updateStatus && updateStatus.includes('Ready to install') && (
                    <button 
                      onClick={handleInstallUpdate}
                      className="update-button install-button"
                    >
                      Install & Restart
                    </button>
                  )}
                </div>
                
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
              onContextMenu={(e) => {
                e.preventDefault();
                const input = e.target;
                const menu = document.createElement('div');
                menu.className = 'context-menu';
                menu.innerHTML = `
                  <div class="context-menu-item" data-action="paste">Paste</div>
                  <div class="context-menu-item" data-action="cut">Cut</div>
                  <div class="context-menu-item" data-action="copy">Copy</div>
                  <div class="context-menu-item" data-action="selectall">Select All</div>
                `;
                
                menu.style.position = 'fixed';
                menu.style.left = e.clientX + 'px';
                menu.style.top = e.clientY + 'px';
                menu.style.zIndex = '10000';
                
                document.body.appendChild(menu);
                
                const handleMenuClick = async (menuEvent) => {
                  const action = menuEvent.target.dataset.action;
                  
                  switch(action) {
                    case 'paste':
                      try {
                        // First try the modern clipboard API
                        const text = await navigator.clipboard.readText();
                        console.log('✅ Clipboard read successful:', text.substring(0, 50) + '...');
                        setNewFeedUrl(text);
                      } catch (err) {
                        console.log('🚫 Clipboard read failed, trying execCommand:', err);
                        try {
                          // Fallback to execCommand
                          input.focus();
                          input.select();
                          const success = document.execCommand('paste');
                          if (success) {
                            console.log('✅ execCommand paste successful');
                            // Get the value after paste
                            setTimeout(() => {
                              setNewFeedUrl(input.value);
                            }, 10);
                          } else {
                            console.log('🚫 execCommand paste failed');
                          }
                        } catch (execErr) {
                          console.log('🚫 execCommand paste error:', execErr);
                        }
                      }
                      break;
                    case 'cut':
                      input.select();
                      document.execCommand('cut');
                      setNewFeedUrl('');
                      break;
                    case 'copy':
                      input.select();
                      document.execCommand('copy');
                      break;
                    case 'selectall':
                      input.select();
                      break;
                  }
                  
                  document.body.removeChild(menu);
                  document.removeEventListener('click', handleOutsideClick);
                };
                
                const handleOutsideClick = (outsideEvent) => {
                  if (!menu.contains(outsideEvent.target)) {
                    document.body.removeChild(menu);
                    document.removeEventListener('click', handleOutsideClick);
                  }
                };
                
                menu.addEventListener('click', handleMenuClick);
                setTimeout(() => {
                  document.addEventListener('click', handleOutsideClick);
                }, 0);
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