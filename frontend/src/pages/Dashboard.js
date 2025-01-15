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
  ArrowsClockwise
} from 'phosphor-react';
import '../styles/Dashboard.css';

const API_URL = 'http://localhost:3001';

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

  // Fetch feeds on component mount
  useEffect(() => {
    fetchFeeds();
    fetchArticles();
  }, []);

  // Update localStorage when preferences change
  useEffect(() => {
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('font', font);
  }, [font]);

  // Apply mono font to the entire document
  useEffect(() => {
    document.documentElement.style.fontFamily = 
      font === 'mono' ? "'Geist Mono', monospace" : "'Geist Sans', sans-serif";
  }, [font]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? '' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.classList.toggle('dark');
  };

  // Also add this useEffect to set the initial theme on body
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || '';
    setTheme(savedTheme);
    document.documentElement.className = savedTheme;
  }, []);

  const fetchFeeds = async () => {
    try {
      const response = await fetch(`${API_URL}/feeds`, {
        headers: {
          'Accept': 'application/json'
        }
      });
      const text = await response.text();
      console.log('Raw feeds response:', text);
      const data = JSON.parse(text);
      setFeeds(data);
      
      // Create a map of feed IDs to their URLs
      const feedMapping = {};
      data.forEach(feed => {
        feedMapping[feed.id] = feed.url;
      });
      setFeedsMap(feedMapping);
    } catch (error) {
      console.error('Error fetching feeds:', error);
    }
  };

  const fetchArticles = async () => {
    try {
      const response = await fetch(`${API_URL}/articles`, {
        headers: {
          'Accept': 'application/json'
        }
      });
      const text = await response.text();
      console.log('Raw articles response:', text);
      const data = JSON.parse(text);
      setArticles(data);
    } catch (error) {
      console.error('Error fetching articles:', error);
    }
  };

  const addFeed = async () => {
    const url = prompt('Enter RSS feed URL:');
    if (!url) return;

    try {
        const response = await fetch(`${API_URL}/feeds`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ url }),
        });
        
        const text = await response.text();
        console.log('Raw server response:', text);
        
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('Failed to parse response as JSON:', e);
            alert('Server returned invalid JSON response');
            return;
        }
        
        if (response.ok) {
            await fetchFeeds();
            await fetchArticles();
        } else {
            alert(`Error adding feed: ${data.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Error adding feed:', error);
        alert(`Error adding feed: ${error.message}`);
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
    try {
      console.log('Attempting to mark article as read:', articleId);
      const response = await fetch(`${API_URL}/articles/${articleId}/read`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        console.log('Article marked as read on server');
        // Update the local state to mark the article as read
        setArticles(prevArticles => {
          const newArticles = prevArticles.map(article => 
            article.id === articleId 
              ? { ...article, read: true }
              : article
          );
          console.log('Updated articles state:', newArticles.map(a => ({ id: a.id, read: a.read })));
          return newArticles;
        });
      } else {
        console.error('Failed to mark article as read:', await response.text());
      }
    } catch (error) {
      console.error('Error marking article as read:', error);
    }
  };

  const deleteFeed = async (feedId) => {
    if (!window.confirm('Are you sure you want to delete this feed?')) {
        return;
    }

    try {
        console.log('Attempting to delete feed:', feedId);
        const response = await fetch(`${API_URL}/feeds/${feedId}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
        
        console.log('Delete response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Delete response data:', data);
        
        if (data.success) {
            console.log('Feed deleted successfully');
            
            // Update feeds state
            setFeeds(prevFeeds => {
                const newFeeds = prevFeeds.filter(feed => feed.id !== feedId);
                console.log('Updated feeds:', newFeeds);
                return newFeeds;
            });
            
            // Update articles state
            setArticles(prevArticles => {
                const newArticles = prevArticles.filter(article => article.feedId !== feedId);
                console.log('Updated articles:', newArticles);
                return newArticles;
            });
            
            // Reset selected feed if we're deleting the currently selected one
            if (selectedFeed === feedId) {
                setSelectedFeed(null);
            }
        } else {
            throw new Error('Failed to delete feed');
        }
    } catch (error) {
        console.error('Error deleting feed:', error);
        alert('Error deleting feed: ' + error.message);
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
    try {
      await fetchFeeds();
      await fetchArticles();
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  return (
    <div className={`dashboard ${font}`}>
      <div className="dashboard-wrapper">
        <nav className="navbar">
          <h1>ClearFeed</h1>
          <div className="nav-controls">
            <button 
              className="icon-button"
              onClick={handleRefresh}
              title="Refresh"
            >
              <ArrowsClockwise size={24} />
            </button>
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
            {filteredArticles.length > 0 ? (
              <div className="articles-list">
                {filteredArticles.map((article, index) => (
                  <article 
                    key={index} 
                    className={`article-card ${article.read ? 'read' : ''}`}
                  >
                    <div className="article-header">
                      {article.imageUrl && (
                        <div className="article-image">
                          <img 
                            src={article.imageUrl} 
                            alt=""
                            onError={(e) => {
                              console.log('Image failed to load:', article.imageUrl);
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      <div className="article-meta">
                        <h2>
                          <a 
                            href={article.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              e.preventDefault();
                              markAsRead(article.id);
                              window.open(article.link, '_blank');
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
                        onClick={() => toggleReadLater(article.id)}
                        title={readLater.includes(article.id) ? 'Saved' : 'Save for later'}
                      >
                        <Bookmark 
                          size={20}
                          weight={readLater.includes(article.id) ? "fill" : "regular"}
                        />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                {feeds.length === 0 ? 'Add your first RSS feed to get started' : 'No articles found'}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

export default Dashboard; 