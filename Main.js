const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';
const { setupIPC } = require('./ipc');
const db = require('./database');

console.log('Main process starting...');
console.log('Current directory:', __dirname);
console.log('Development mode:', isDev);

// Keep a global reference of the window object
let mainWindow;

const preloadPath = path.join(__dirname, 'preload.js');
console.log('Preload script path:', preloadPath);
if (!require('fs').existsSync(preloadPath)) {
    console.error('Preload script not found at:', preloadPath);
    process.exit(1);
} else {
    console.log('Preload script found successfully');
}

console.log('Setting up IPC handlers...');
setupIPC();

function createWindow() {
    console.log('Creating window...');
    console.log('Database initialized:', !!db);
    
    // Verify preload script exists
    if (!require('fs').existsSync(preloadPath)) {
        console.error('CRITICAL: Preload script not found at:', preloadPath);
        app.quit();
        return;
    }

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'ClearFeed',
        icon: path.join(__dirname, 'assets/icon.icns'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: preloadPath,
            sandbox: false,
            devTools: true,
            worldSafeExecuteJavaScript: true,
            webSecurity: false,  // Allow loading external content in iframes
            allowRunningInsecureContent: true,  // Allow mixed content
            experimentalFeatures: true,  // Enable experimental web features
            additionalArguments: [
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-site-isolation-trials',
                '--disable-features=BlockInsecurePrivateNetworkRequests'
            ]
        }
    });

    // Wait for the window to be ready before loading content
    mainWindow.webContents.on('did-create-window', () => {
        console.log('Window created, waiting for preload...');
    });

    // Listen to console messages from renderer
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        const levelStr = typeof level === 'string' ? level : String(level);
        console.log(`[RENDERER ${levelStr.toUpperCase()}]:`, message);
    });

    // Load content only after DOM is ready
    mainWindow.webContents.on('dom-ready', () => {
        console.log('DOM ready, checking electron availability');
        mainWindow.webContents.executeJavaScript(`
            console.log('Electron availability check:', {
                electron: !!window.electron,
                ipcRenderer: !!window.electron?.ipcRenderer
            });
        `);
    });

    // Load the app from built files
    const htmlPath = path.join(__dirname, 'frontend/build/index.html');
    console.log('Loading file:', htmlPath);
    console.log('File exists:', require('fs').existsSync(htmlPath));
    
    if (require('fs').existsSync(htmlPath)) {
        mainWindow.loadFile(htmlPath).catch(err => {
            console.error('Failed to load file:', err);
        });
    } else {
        console.error('Build files not found. Please run: cd frontend && npm run build');
        app.quit();
    }
    
    // Open dev tools in development
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    // Emitted when the window is closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Block popup windows for this specific webContents
    mainWindow.webContents.setWindowOpenHandler((details) => {
        console.log('Blocked popup attempt:', details.url);
        return { action: 'deny' };
    });
    
    // Update the existing did-finish-load handler
    mainWindow.webContents.on('did-finish-load', () => {
        console.log('Window loaded, testing IPC availability');
        mainWindow.webContents.executeJavaScript(`
            if (window.electron && window.electron.ipcRenderer) {
                console.log('IPC is available in renderer');
                if (window.electronTest && window.electronTest.testAPI) {
                    console.log('Test API result:', window.electronTest.testAPI());
                }
            } else {
                console.error('IPC is not available in renderer');
            }
            
            // Block popups in all frames with enhanced debugging
                function blockPopups() {
                    console.log('🛡️ Initializing comprehensive popup blocking system...');
                // Override window.open and related methods with detailed logging
                    const originalWindowOpen = window.open;
                    window.open = function(...args) {
                        console.log('🚫 POPUP BLOCKED - window.open attempt:', {
                            url: args[0],
                            target: args[1],
                            features: args[2],
                            stack: new Error().stack.split('\n').slice(0, 5).join('\n')
                        });
                        // Log to main process for debugging
                        if (window.electronAPI) {
                            window.electronAPI.logPopupAttempt('window.open', args[0]);
                        }
                        // Return a mock window object to prevent errors
                        return {
                            closed: true,
                            close: () => {},
                            focus: () => {},
                            blur: () => {},
                            postMessage: () => {},
                            location: { href: 'about:blank' }
                        };
                    };
                
                // Block other popup methods with detailed logging
                if (window.showModalDialog) {
                    window.showModalDialog = function(...args) {
                        console.log('🚫 POPUP BLOCKED - showModalDialog attempt:', {
                            url: args[0],
                            args: args,
                            stack: new Error().stack
                        });
                        if (window.electronAPI) {
                            window.electronAPI.logPopupAttempt('showModalDialog', args[0]);
                        }
                        return null;
                    };
                }
                
                // Block window focus/blur completely with detailed logging
                window.focus = function() {
                    console.log('🚫 POPUP BLOCKED - window.focus attempt:', {
                        stack: new Error().stack
                    });
                    if (window.electronAPI) {
                        window.electronAPI.logPopupAttempt('window.focus', window.location.href);
                    }
                    return false;
                };
                window.blur = function() {
                    console.log('🚫 POPUP BLOCKED - window.blur attempt:', {
                        stack: new Error().stack
                    });
                    if (window.electronAPI) {
                        window.electronAPI.logPopupAttempt('window.blur', window.location.href);
                    }
                    return false;
                };
                
                // Block window.print which can be used for popups
                window.print = function() {
                    console.log('Blocked window.print attempt');
                    return false;
                };
                
                // Block window.alert, confirm, prompt which can be popup-like
                const originalAlert = window.alert;
                const originalConfirm = window.confirm;
                const originalPrompt = window.prompt;
                
                window.alert = function(msg) {
                    if (msg && (msg.toString().includes('popup') || msg.toString().includes('ad') || msg.toString().includes('click'))) {
                        console.log('Blocked suspicious alert:', msg);
                        return;
                    }
                    return originalAlert.call(this, msg);
                };
                
                window.confirm = function(msg) {
                    if (msg && (msg.toString().includes('popup') || msg.toString().includes('ad') || msg.toString().includes('click'))) {
                        console.log('Blocked suspicious confirm:', msg);
                        return false;
                    }
                    return originalConfirm.call(this, msg);
                };
                
                window.prompt = function(msg) {
                    if (msg && (msg.toString().includes('popup') || msg.toString().includes('ad') || msg.toString().includes('click'))) {
                        console.log('Blocked suspicious prompt:', msg);
                        return null;
                    }
                    return originalPrompt.call(this, msg);
                };
                
                // Block document.write attempts that might create popups
                const originalDocWrite = document.write;
                document.write = function(content) {
                    if (content && (
                        content.includes('window.open') ||
                        content.includes('popup') ||
                        content.includes('overlay') ||
                        content.includes('modal')
                    )) {
                        console.log('Blocked suspicious document.write:', content.substring(0, 100));
                        return;
                    }
                    return originalDocWrite.call(this, content);
                };
                
                // Block eval attempts that might create popups
                const originalEval = window.eval;
                window.eval = function(code) {
                    if (code && typeof code === 'string' && (
                        code.includes('window.open') ||
                        code.includes('popup') ||
                        code.includes('overlay') ||
                        code.includes('modal')
                    )) {
                        console.log('Blocked suspicious eval:', code.substring(0, 100));
                        return;
                    }
                    return originalEval.call(this, code);
                };
                
                // Block setTimeout/setInterval with popup code
                const originalSetTimeout = window.setTimeout;
                window.setTimeout = function(func, delay) {
                    if (typeof func === 'string' && (
                        func.includes('window.open') ||
                        func.includes('popup') ||
                        func.includes('overlay') ||
                        func.includes('modal')
                    )) {
                        console.log('Blocked suspicious setTimeout:', func.substring(0, 100));
                        return;
                    }
                    return originalSetTimeout.call(this, func, delay);
                };
                
                const originalSetInterval = window.setInterval;
                 window.setInterval = function(func, delay) {
                     if (typeof func === 'string' && (
                         func.includes('window.open') ||
                         func.includes('popup') ||
                         func.includes('overlay') ||
                         func.includes('modal')
                     )) {
                         console.log('Blocked suspicious setInterval:', func.substring(0, 100));
                         return;
                     }
                     return originalSetInterval.call(this, func, delay);
                 };
                 
                 // Block createElement for popup elements
                 const originalCreateElement = document.createElement;
                 document.createElement = function(tagName) {
                     const element = originalCreateElement.call(this, tagName);
                     
                     // Override setAttribute to block popup-related attributes
                     const originalSetAttribute = element.setAttribute;
                     element.setAttribute = function(name, value) {
                         if (name === 'onclick' && value && (
                             value.includes('window.open') ||
                             value.includes('popup') ||
                             value.includes('overlay') ||
                             value.includes('modal')
                         )) {
                             console.log('Blocked popup onclick attribute:', value.substring(0, 100));
                             return;
                         }
                         return originalSetAttribute.call(this, name, value);
                     };
                     
                     return element;
                 };
                 
                 // Block addEventListener for popup events
                 const originalAddEventListener = EventTarget.prototype.addEventListener;
                 EventTarget.prototype.addEventListener = function(type, listener, options) {
                     if (typeof listener === 'string' && (
                         listener.includes('window.open') ||
                         listener.includes('popup') ||
                         listener.includes('overlay') ||
                         listener.includes('modal')
                     )) {
                         console.log('Blocked popup event listener:', listener.substring(0, 100));
                         return;
                     }
                     return originalAddEventListener.call(this, type, listener, options);
                 };
                
                // Block focus/blur events that can trigger popups
                ['focus', 'blur', 'beforeunload'].forEach(event => {
                    window.addEventListener(event, function(e) {
                        if (e.target !== window && e.target !== document) {
                            e.stopPropagation();
                            e.preventDefault();
                        }
                    }, true);
                });
                
                // Block right-click context menu popups
                 document.addEventListener('contextmenu', function(e) {
                     const target = e.target;
                     if (target.tagName === 'A' || target.onclick || target.href) {
                         e.preventDefault();
                         console.log('Blocked context menu popup');
                     }
                 }, true);
                 
                 // Block suspicious click events that might trigger popups
                 document.addEventListener('click', function(e) {
                     const target = e.target;
                     const href = target.href || target.getAttribute('href') || target.closest('a')?.href || '';
                     
                     // Block clicks on suspicious links
                     if (href && (
                         href.includes('popup') || 
                         href.includes('popunder') ||
                         href.includes('redirect') ||
                         href.includes('_blank') ||
                         href.startsWith('javascript:') ||
                         href.includes('window.open') ||
                         href.includes('overlay') ||
                         href.includes('modal') ||
                         href.includes('lightbox') ||
                         href.includes('interstitial')
                     )) {
                         e.preventDefault();
                         e.stopPropagation();
                         console.log('Blocked suspicious click:', href);
                         return false;
                     }
                     
                     // Block clicks with target="_blank" that might be popups
                     if ((target.target === '_blank' || target.closest('a')?.target === '_blank') && !e.ctrlKey && !e.metaKey) {
                         e.preventDefault();
                         e.stopPropagation();
                         console.log('Blocked _blank popup click');
                         return false;
                     }
                     
                     // Block clicks on elements with popup-related classes or IDs
                     const element = target.closest('[class*="popup"], [class*="overlay"], [class*="modal"], [id*="popup"], [id*="overlay"], [id*="modal"]');
                     if (element) {
                         console.log('Blocked popup element click:', element.className || element.id);
                         e.preventDefault();
                         e.stopPropagation();
                         return false;
                     }
                 }, true);
                 
                 // Block mousedown events that might trigger popups
                 document.addEventListener('mousedown', function(e) {
                     if (e.button === 1) { // Middle mouse button
                         const target = e.target;
                         const href = target.href || target.getAttribute('href');
                         if (href && href.includes('popup')) {
                             e.preventDefault();
                             e.stopPropagation();
                             console.log('Blocked middle-click popup');
                         }
                     }
                 }, true);
                 
                 // Block overlay and modal creation
                 const popupObserver = new MutationObserver(function(mutations) {
                     mutations.forEach(function(mutation) {
                         mutation.addedNodes.forEach(function(node) {
                             if (node.nodeType === 1) { // Element node
                                 // Check for popup/overlay elements
                                 if (node.matches && (
                                     node.matches('[class*="popup"]') ||
                                     node.matches('[class*="overlay"]') ||
                                     node.matches('[class*="modal"]') ||
                                     node.matches('[id*="popup"]') ||
                                     node.matches('[id*="overlay"]') ||
                                     node.matches('[id*="modal"]') ||
                                     node.matches('[style*="position: fixed"]') ||
                                     node.matches('[style*="z-index"]')
                                 )) {
                                     console.log('Blocked popup element creation:', node.className || node.id);
                                     node.remove();
                                 }
                                 
                                 // Check child elements too
                                 const popupElements = node.querySelectorAll && node.querySelectorAll('[class*="popup"], [class*="overlay"], [class*="modal"], [id*="popup"], [id*="overlay"], [id*="modal"]');
                                 if (popupElements) {
                                     popupElements.forEach(function(el) {
                                         console.log('Blocked nested popup element:', el.className || el.id);
                                         el.remove();
                                     });
                                 }
                             }
                         });
                     });
                 });
                 
                 popupObserver.observe(document.body, {
                     childList: true,
                     subtree: true
                 });
                
                // Block popups in iframes
                const frames = document.querySelectorAll('iframe');
                frames.forEach(frame => {
                    try {
                        if (frame.contentWindow) {
                            frame.contentWindow.open = function() {
                                console.log('Blocked iframe popup');
                                return null;
                            };
                            
                            // Block iframe focus events
                            frame.contentWindow.addEventListener('focus', function(e) {
                                e.stopPropagation();
                                e.preventDefault();
                            }, true);
                        }
                    } catch (e) {
                        // Cross-origin iframe, can't access
                    }
                });
                
                // Block all forms of window creation and manipulation
                const originalCreateElement = document.createElement;
                document.createElement = function(tagName) {
                    const element = originalCreateElement.call(this, tagName);
                    
                    // Block iframe creation with suspicious sources
                    if (tagName.toLowerCase() === 'iframe') {
                        const originalSetAttribute = element.setAttribute;
                        element.setAttribute = function(name, value) {
                            if (name === 'src' && value && (
                                value.includes('popup') ||
                                value.includes('ad') ||
                                value.includes('banner') ||
                                value.includes('overlay')
                            )) {
                                console.log('Blocked suspicious iframe src:', value);
                                return;
                            }
                            return originalSetAttribute.call(this, name, value);
                        };
                    }
                    
                    return element;
                };
                
                // Block History API manipulation that could trigger popups
                const originalPushState = history.pushState;
                const originalReplaceState = history.replaceState;
                
                history.pushState = function(state, title, url) {
                    if (url && (url.includes('popup') || url.includes('overlay'))) {
                        console.log('Blocked popup history manipulation');
                        return;
                    }
                    return originalPushState.call(this, state, title, url);
                };
                
                history.replaceState = function(state, title, url) {
                    if (url && (url.includes('popup') || url.includes('overlay'))) {
                        console.log('Blocked popup history manipulation');
                        return;
                    }
                    return originalReplaceState.call(this, state, title, url);
                };
                
                // Block postMessage that might trigger popups
                const originalPostMessage = window.postMessage;
                window.postMessage = function(message, targetOrigin, transfer) {
                    if (typeof message === 'string' && (
                        message.includes('popup') ||
                        message.includes('window.open') ||
                        message.includes('overlay')
                    )) {
                        console.log('Blocked popup postMessage:', message.substring(0, 100));
                        return;
                    }
                    return originalPostMessage.call(this, message, targetOrigin, transfer);
                };
                
                // Block location changes that might be popups
                const originalLocationAssign = location.assign;
                const originalLocationReplace = location.replace;
                
                location.assign = function(url) {
                    if (url && (url.includes('popup') || url.includes('overlay'))) {
                        console.log('Blocked popup location.assign:', url);
                        return;
                    }
                    return originalLocationAssign.call(this, url);
                };
                
                location.replace = function(url) {
                    if (url && (url.includes('popup') || url.includes('overlay'))) {
                        console.log('Blocked popup location.replace:', url);
                        return;
                    }
                    return originalLocationReplace.call(this, url);
                };
                
                // Block all click events on suspicious elements more aggressively
                document.addEventListener('click', function(e) {
                    const target = e.target;
                    const tagName = target.tagName ? target.tagName.toLowerCase() : '';
                    
                    // Block clicks on any element with suspicious attributes
                    if (target.onclick || target.getAttribute('onclick') ||
                        target.getAttribute('data-popup') ||
                        target.getAttribute('data-modal') ||
                        target.getAttribute('data-overlay') ||
                        (target.className && target.className.toString().match(/(popup|modal|overlay|ad|banner|interstitial)/i)) ||
                        (target.id && target.id.match(/(popup|modal|overlay|ad|banner|interstitial)/i))) {
                        
                        console.log('🚫 Blocked suspicious element click:', {
                            tagName,
                            className: target.className,
                            id: target.id,
                            href: target.href,
                            onclick: target.onclick ? 'present' : 'none'
                        });
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        return false;
                    }
                    
                    // Block all external links that open in new windows
                    if (tagName === 'a' && target.target === '_blank') {
                        const href = target.href || '';
                        if (!href.startsWith(window.location.origin) && !href.startsWith('about:')) {
                            console.log('🚫 Blocked external _blank link:', href);
                            e.preventDefault();
                            e.stopPropagation();
                            return false;
                        }
                    }
                    
                    // Block clicks that might trigger protocol changes or subscriptions
                     if (tagName === 'a') {
                         const href = target.href || '';
                         const text = target.textContent || '';
                         if (href.startsWith('javascript:') || href.startsWith('data:') || 
                             href.includes('popup') || href.includes('subscribe') || 
                             href.includes('newsletter') || href.includes('signup') ||
                             text.toLowerCase().includes('subscribe') || 
                             text.toLowerCase().includes('newsletter')) {
                             console.log('🚫 Blocked suspicious protocol/subscription link:', href, text);
                             e.preventDefault();
                             e.stopPropagation();
                             return false;
                         }
                     }
                     
                     // Block subscription-related buttons and divs
                     if (['button', 'div', 'span'].includes(tagName)) {
                         const text = target.textContent || '';
                         const ariaLabel = target.getAttribute('aria-label') || '';
                         if (text.toLowerCase().includes('subscribe') || 
                             text.toLowerCase().includes('newsletter') ||
                             text.toLowerCase().includes('sign up') ||
                             ariaLabel.toLowerCase().includes('subscribe') ||
                             ariaLabel.toLowerCase().includes('newsletter')) {
                             console.log('🚫 Blocked subscription element:', tagName, text, ariaLabel);
                             e.preventDefault();
                             e.stopPropagation();
                             return false;
                         }
                     }
                }, true);
                
                // Block all touch events that might trigger popups
                ['touchstart', 'touchend', 'touchmove'].forEach(eventType => {
                    document.addEventListener(eventType, function(e) {
                        const target = e.target;
                        const className = target.className || '';
                        const id = target.id || '';
                        
                        if (className.match(/popup|modal|overlay|ad|banner/i) || id.match(/popup|modal|overlay|ad|banner/i)) {
                            console.log('Blocked touch event on popup element:', eventType);
                            e.preventDefault();
                            e.stopPropagation();
                            return false;
                        }
                    }, true);
                });
                
                // Block keyboard shortcuts that might trigger popups
                document.addEventListener('keydown', function(e) {
                    // Block Ctrl+N (new window), Ctrl+Shift+N (incognito), Ctrl+T (new tab)
                    if (e.ctrlKey && (e.key === 'n' || e.key === 'N' || e.key === 't' || e.key === 'T')) {
                        console.log('Blocked keyboard shortcut that might open new window:', e.key);
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                    }
                    
                    // Block F11 (fullscreen) which can be used for popup-like behavior
                    if (e.key === 'F11') {
                        console.log('Blocked F11 fullscreen attempt');
                        e.preventDefault();
                        e.stopPropagation();
                        return false;
                    }
                }, true);
                
                // Block all mousedown events that might trigger popups
                document.addEventListener('mousedown', function(e) {
                    if (e.button === 1 || e.button === 2) { // Middle or right click
                        const target = e.target;
                        if (target.href || target.onclick || target.getAttribute('onclick')) {
                            console.log('Blocked middle/right-click popup attempt');
                            e.preventDefault();
                            e.stopPropagation();
                            return false;
                        }
                    }
                }, true);
            }
            
            // Apply popup blocking immediately and on DOM changes
                try {
                    blockPopups();
                    console.log('✅ Popup blocking system initialized successfully');
                } catch (error) {
                    console.error('❌ Error initializing popup blocking:', error);
                }
                
                // Monitor for new iframes and dynamic content including subscription modals
                 const observer = new MutationObserver((mutations) => {
                     try {
                         mutations.forEach(mutation => {
                             if (mutation.addedNodes.length > 0) {
                                 mutation.addedNodes.forEach(node => {
                                     if (node.nodeType === 1) { // Element node
                                         // Re-apply blocking to new elements
                                         if (node.tagName === 'IFRAME' || node.querySelector('iframe')) {
                                             console.log('🔍 New iframe detected, applying popup blocking');
                                             blockPopups();
                                         }
                                         
                                         // Block subscription modals and overlays
                                         const nodeText = node.textContent || '';
                                         const nodeClass = node.className || '';
                                         const nodeId = node.id || '';
                                         
                                         if (nodeText.toLowerCase().includes('subscribe') ||
                                             nodeText.toLowerCase().includes('newsletter') ||
                                             nodeText.toLowerCase().includes('sign up') ||
                                             nodeClass.toString().match(/(modal|overlay|popup|subscribe|newsletter|signup)/i) ||
                                             nodeId.match(/(modal|overlay|popup|subscribe|newsletter|signup)/i)) {
                                             
                                             console.log('🚫 Removing subscription modal/overlay:', {
                                                 tagName: node.tagName,
                                                 className: nodeClass,
                                                 id: nodeId,
                                                 text: nodeText.substring(0, 100)
                                             });
                                             
                                             // Hide the element
                                             node.style.display = 'none !important';
                                             node.style.visibility = 'hidden !important';
                                             node.style.opacity = '0 !important';
                                             node.style.zIndex = '-9999 !important';
                                             
                                             // Try to remove it completely
                                             setTimeout(() => {
                                                 try {
                                                     if (node.parentNode) {
                                                         node.parentNode.removeChild(node);
                                                     }
                                                 } catch (e) {
                                                     console.log('Could not remove node:', e);
                                                 }
                                             }, 100);
                                         }
                                         
                                         // Check for subscription-related child elements
                                         if (node.querySelector) {
                                             const suspiciousElements = node.querySelectorAll('[class*="subscribe"], [class*="newsletter"], [class*="modal"], [class*="overlay"], [id*="subscribe"], [id*="newsletter"], [id*="modal"], [id*="overlay"]');
                                             suspiciousElements.forEach(el => {
                                                 const elText = el.textContent || '';
                                                 if (elText.toLowerCase().includes('subscribe') ||
                                                     elText.toLowerCase().includes('newsletter') ||
                                                     elText.toLowerCase().includes('sign up')) {
                                                     console.log('🚫 Hiding suspicious child element:', el.className, el.id);
                                                     el.style.display = 'none !important';
                                                     el.style.visibility = 'hidden !important';
                                                 }
                                             });
                                         }
                                     }
                                 });
                             }
                         });
                     } catch (error) {
                         console.error('❌ Error in mutation observer:', error);
                     }
                 });
                
                if (document.body) {
                     observer.observe(document.body, { childList: true, subtree: true });
                 } else {
                     document.addEventListener('DOMContentLoaded', () => {
                         observer.observe(document.body, { childList: true, subtree: true });
                     });
                 }
                 
                 // Inject CSS to hide subscription modals and overlays
                  const style = document.createElement('style');
                  style.textContent = 
                      '/* Hide subscription modals and overlays */' +
                      '[class*="subscribe"][class*="modal"],' +
                      '[class*="newsletter"][class*="modal"],' +
                      '[class*="signup"][class*="modal"],' +
                      '[id*="subscribe"][id*="modal"],' +
                      '[id*="newsletter"][id*="modal"],' +
                      '[id*="signup"][id*="modal"],' +
                      '.subscription-modal,' +
                      '.newsletter-modal,' +
                      '.signup-modal,' +
                      '.subscribe-overlay,' +
                      '.newsletter-overlay,' +
                      '.signup-overlay,' +
                      '[data-testid*="subscribe"],' +
                      '[data-testid*="newsletter"],' +
                      '[data-testid*="signup"],' +
                      '/* The Verge specific selectors */' +
                      '[class*="duet-modal"],' +
                      '[class*="subscription"],' +
                      '[class*="paywall"],' +
                      '[data-module*="subscribe"],' +
                      '[data-module*="newsletter"],' +
                      '/* Enhanced The Verge blocking */' +
                      '[class*="_1ds4jca"],' +
                      '[class*="duet-subscribe"],' +
                      '[class*="email-capture"],' +
                      '[class*="newsletter-signup"],' +
                      '[class*="subscription-prompt"],' +
                      '.c-newsletter-signup,' +
                      '.c-subscribe-form,' +
                      '.p-newsletter,' +
                      'iframe[src*="subscribe"],' +
                      'iframe[src*="newsletter"],' +
                      'div[style*="position: fixed"][style*="z-index"],' +
                      'div[style*="position: absolute"][style*="z-index: 9"],' +
                      '/* Generic popup patterns */' +
                      '[class*="popup"],' +
                      '[class*="modal"],' +
                      '[class*="overlay"],' +
                      '[id*="popup"],' +
                      '[id*="modal"],' +
                      '[id*="overlay"] {' +
                      'display: none !important;' +
                      'visibility: hidden !important;' +
                      'opacity: 0 !important;' +
                      'z-index: -9999 !important;' +
                      'position: absolute !important;' +
                      'left: -9999px !important;' +
                      'top: -9999px !important;' +
                      'pointer-events: none !important;' +
                      '}' +
                      '/* Hide backdrop/overlay elements */' +
                      '.modal-backdrop,' +
                      '.overlay-backdrop,' +
                      '[class*="backdrop"],' +
                      '[class*="overlay"][style*="fixed"] {' +
                      'display: none !important;' +
                      '}' +
                      '/* Prevent body scroll lock */' +
                      'body.modal-open,' +
                      'body.no-scroll,' +
                      'body[style*="overflow: hidden"] {' +
                      'overflow: auto !important;' +
                      '}';
                 document.head.appendChild(style);
                 
                 // Periodic cleanup function to remove subscription modals
                 const cleanupSubscriptionModals = () => {
                     try {
                         const suspiciousSelectors = [
                              '[class*="subscribe"]',
                              '[class*="newsletter"]', 
                              '[class*="signup"]',
                              '[class*="modal"]',
                              '[class*="overlay"]',
                              '[class*="popup"]',
                              '[id*="subscribe"]',
                              '[id*="newsletter"]',
                              '[id*="modal"]',
                              '[id*="popup"]',
                              '[data-testid*="subscribe"]',
                              '[data-testid*="newsletter"]',
                              '[data-module*="subscribe"]',
                              '/* The Verge specific patterns */',
                              '[class*="_1ds4jca"]',
                              '[class*="duet-"]',
                              '[class*="email-capture"]',
                              'div[style*="position: fixed"]',
                              'div[style*="z-index: 9"]',
                              'div[style*="z-index: 10"]',
                              'div[style*="z-index: 11"]',
                              'div[style*="z-index: 12"]'
                          ];
                         
                         suspiciousSelectors.forEach(selector => {
                             const elements = document.querySelectorAll(selector);
                             elements.forEach(el => {
                                 const text = el.textContent || '';
                                 const isVisible = el.offsetWidth > 0 && el.offsetHeight > 0;
                                 const computedStyle = window.getComputedStyle(el);
                                 const isFixed = computedStyle.position === 'fixed';
                                 const hasHighZIndex = parseInt(computedStyle.zIndex) > 1000;
                                 
                                 // Check for subscription-related text patterns
                                 const suspiciousText = text.toLowerCase();
                                 const hasSubscriptionText = suspiciousText.includes('subscribe') ||
                                     suspiciousText.includes('newsletter') ||
                                     suspiciousText.includes('sign up') ||
                                     suspiciousText.includes('email') ||
                                     suspiciousText.includes('join') ||
                                     suspiciousText.includes('get updates') ||
                                     suspiciousText.includes('stay informed');
                                 
                                 // Check for modal-like characteristics
                                 const isModalLike = (isFixed && hasHighZIndex) || 
                                     el.className.includes('modal') ||
                                     el.className.includes('overlay') ||
                                     el.className.includes('popup') ||
                                     el.className.includes('_1ds4jca');
                                 
                                 if ((isVisible && hasSubscriptionText) || isModalLike) {
                                     console.log('🚫 Periodic cleanup removing:', {
                                         selector,
                                         className: el.className,
                                         id: el.id,
                                         text: text.substring(0, 50),
                                         isFixed,
                                         zIndex: computedStyle.zIndex
                                     });
                                     
                                     el.style.display = 'none !important';
                                     el.style.visibility = 'hidden !important';
                                     el.style.opacity = '0 !important';
                                     el.style.pointerEvents = 'none !important';
                                     try {
                                         el.remove();
                                     } catch (e) {
                                         // Element might already be removed
                                     }
                                 }
                             });
                         });
                         
                         // Remove body scroll locks
                         document.body.style.overflow = '';
                         document.body.classList.remove('modal-open', 'no-scroll');
                         
                     } catch (error) {
                         console.error('❌ Error in periodic cleanup:', error);
                     }
                 };
                 
                 // Run cleanup every 2 seconds
                 setInterval(cleanupSubscriptionModals, 2000);
                 
                 // Run cleanup on page load and after a delay
                 setTimeout(cleanupSubscriptionModals, 1000);
                 setTimeout(cleanupSubscriptionModals, 3000);
                 setTimeout(cleanupSubscriptionModals, 5000);
        `).catch(console.error);
    });
}

// Ad blocking filter lists - common ad domains and tracking scripts
const adBlockFilters = [
    // Google Ads
    'googleads.g.doubleclick.net',
    'googlesyndication.com',
    'googleadservices.com',
    'google-analytics.com',
    'googletagmanager.com',
    'googletagservices.com',
    
    // Facebook/Meta tracking
    'facebook.com/tr',
    'connect.facebook.net',
    'facebook.net',
    
    // Amazon ads
    'amazon-adsystem.com',
    'amazonaax.com',
    
    // Other major ad networks
    'adsystem.com',
    'adsense.com',
    'doubleclick.net',
    'outbrain.com',
    'taboola.com',
    'criteo.com',
    'adsrvr.org',
    'adnxs.com',
    'rlcdn.com',
    'scorecardresearch.com',
    'quantserve.com',
    'addthis.com',
    'sharethis.com',
    'disqus.com/embed',
    'zergnet.com',
    'mgid.com',
    'revcontent.com',
    'content.ad',
    'adskeeper.co.uk',
    'propellerads.com',
    'popads.net',
    'popcash.net',
    'adcash.com',
    'bidvertiser.com',
    'chitika.com',
    'infolinks.com',
    'media.net',
    'skimlinks.com',
    'viglink.com',
    'linksynergy.com',
    'commission-junction.com',
    'cj.com',
    'shareasale.com',
    'clickbank.net',
    'tradedoubler.com',
    'zanox.com',
    'awin1.com',
    'impact-ad.jp',
    'adsystem.com',
    'ads.yahoo.com',
    'advertising.com',
    'adsystem.com',
    
    // Additional popup and redirect domains
    'popunder.net',
    'popup.com',
    'redirect.com',
    'clicksor.com',
    'exitjunction.com',
    'exoclick.com',
    'juicyads.com',
    'trafficjunky.net',
    'ero-advertising.com',
    'adsterra.com',
    'hilltopads.net',
    'propellerads.com',
    'adnium.com',
    'clickadu.com',
    'adspyglass.com',
    'trafficstars.com',
    'plugrush.com',
    'adxpansion.com',
    'adnxs.com',
    'adskeeper.co.uk',
    'mgid.com',
    'revcontent.com',
    
    // Additional popup and interstitial domains
     'interstitialads.com',
     'overlayads.com',
     'modalads.com',
     'lightboxads.com',
     'fullscreenads.com',
     'redirectads.com',
     'popupads.com',
     'bannerads.com',
     'displayads.com',
     'nativeads.com',
     
     // The Verge specific subscription/popup domains (excluding platform.theverge.com for images)
     'api.parsely.com',
     'wizardstrategy.com',
     'theverge.com/subscribe',
     'sail-track.com',
     'sail-personalize.com',
     'concertads-configs.vox-cdn.com',
     'concert.io',
     'coral.coralproject.net',
     'doubleverify.com',
     'rubiconproject.com',
     'cookielaw.org'
];

// Check if URL should be blocked
function shouldBlockRequest(url) {
    const urlLower = url.toLowerCase();
    return adBlockFilters.some(filter => {
        return urlLower.includes(filter) || 
               urlLower.includes(`//${filter}`) ||
               urlLower.includes(`www.${filter}`) ||
               urlLower.endsWith(filter);
    }) || 
    // Block common ad script patterns
    /\/(ads?|advertisement|banner|popup|tracking|analytics|metrics)\//.test(urlLower) ||
    /\/(ads?|advertisement|banner|popup|tracking|analytics|metrics)\.(js|css|png|jpg|gif|svg)/.test(urlLower) ||
    // Block tracking pixels
    /\/(pixel|beacon|track|collect)\?/.test(urlLower) ||
    // Block social media widgets
    /\/widgets?\.(js|css)/.test(urlLower) && (urlLower.includes('facebook') || urlLower.includes('twitter') || urlLower.includes('linkedin')) ||
    // Block popup-related patterns
    /\/(popup|popunder|overlay|modal|lightbox|interstitial)\//.test(urlLower) ||
    /\/(popup|popunder|overlay|modal|lightbox|interstitial)\.(js|css|html)/.test(urlLower) ||
    // Block common popup domains
    urlLower.includes('popads') || urlLower.includes('popcash') || urlLower.includes('popunder') ||
    urlLower.includes('interstitial') || urlLower.includes('overlay') ||
    // Block redirect patterns
    /\/redirect\?/.test(urlLower) || /\/redir\?/.test(urlLower) || /\/go\?/.test(urlLower) ||
    // Block suspicious query parameters
     /[?&](popup|overlay|modal|interstitial|redirect|subscribe|newsletter|signup)=/.test(urlLower) ||
     // Block suspicious file extensions
     /\.(popup|overlay|modal)\.(js|css|html)$/.test(urlLower) ||
     // Block The Verge specific subscription patterns (but not images)
     (urlLower.includes('/subscribe') && !urlLower.includes('.webp') && !urlLower.includes('.jpg') && !urlLower.includes('.png')) || 
     (urlLower.includes('/newsletter') && !urlLower.includes('.webp') && !urlLower.includes('.jpg') && !urlLower.includes('.png')) ||
     urlLower.includes('parsely.com') || urlLower.includes('wizardstrategy.com') ||
     urlLower.includes('sail-track.com') || urlLower.includes('sail-personalize.com') ||
     urlLower.includes('concertads-configs') || urlLower.includes('concert.io') ||
     urlLower.includes('coral.coralproject.net') || urlLower.includes('doubleverify.com') ||
     urlLower.includes('rubiconproject.com') || urlLower.includes('cookielaw.org') ||
     // Block specific tracking and subscription endpoints
     /\/metrics\/gtm\.js/.test(urlLower) || /\/ad-block-service-worker/.test(urlLower) ||
     /\/embed\/bootstrap/.test(urlLower) || /\/personalize\/initialize/.test(urlLower) ||
     // Block service workers that might handle popups
     urlLower.includes('service-worker.js') && (urlLower.includes('ad') || urlLower.includes('popup'));
}

app.whenReady().then(() => {
    console.log('App is ready, setting up CSP bypass, ad blocking, and popup blocking...');
    
    // Ad blocking - block requests to known ad domains
    session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
        const shouldBlock = shouldBlockRequest(details.url);
        
        if (shouldBlock) {
            console.log('🚫 Blocked ad/popup request:', details.url.substring(0, 100) + '...');
            callback({ cancel: true });
        } else {
            callback({ cancel: false });
        }
    });
    
    // Block popup windows and most permissions, but allow clipboard access
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        // Allow clipboard permissions for paste functionality
        if (permission === 'clipboard-read' || permission === 'clipboard-write') {
            console.log('✅ Allowing clipboard permission:', permission);
            callback(true);
            return;
        }
        
        console.log('🚫 Blocked permission request:', permission);
        callback(false); // Block all other permissions to prevent popup-related requests
    });
    
    // Additional popup blocking at the session level
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
        console.log('🚫 Blocked display media request (potential popup)');
        callback({ video: null, audio: null });
    });
    
    // Block all webContents creation that might be popups
    app.on('web-contents-created', (event, contents) => {
        console.log('🔍 New web contents created, applying popup blocking...');
        
        // Block new window creation for this webContents, but allow trusted domains
        contents.setWindowOpenHandler((details) => {
            const url = details.url.toLowerCase();
            
            // Allow trusted domains for GitHub and donation links
            const trustedDomains = [
                'github.com',
                'ko-fi.com',
                'paypal.com',
                'patreon.com'
            ];
            
            const isTrustedDomain = trustedDomains.some(domain => url.includes(domain));
            
            if (isTrustedDomain) {
                console.log('✅ Allowing trusted domain:', details.url);
                return { action: 'allow' };
            }
            
            console.log('🚫 Blocked popup window attempt:', {
                url: details.url,
                frameName: details.frameName,
                features: details.features,
                disposition: details.disposition
            });
            return { action: 'deny' };
        });
        
        // Block will-navigate events to popup URLs
        contents.on('will-navigate', (event, navigationUrl) => {
            const url = navigationUrl.toLowerCase();
            if (url.includes('popup') || url.includes('overlay') || url.includes('modal') || 
                url.includes('ad.') || url.includes('/ads/') || url.includes('banner') ||
                url.includes('interstitial') || url.includes('redirect')) {
                console.log('🚫 Blocked popup navigation:', navigationUrl);
                event.preventDefault();
            }
        });
        
        // Block new-window events (alternative popup blocking)
        contents.on('new-window', (event, navigationUrl, frameName, disposition) => {
            console.log('🚫 Blocked new window creation:', {
                url: navigationUrl,
                frameName,
                disposition
            });
            event.preventDefault();
        });
        
        // Add additional security measures
        contents.on('did-create-window', (window, details) => {
            console.log('🚫 Unexpected window creation detected, closing:', details.url);
            window.destroy();
        });
    });
    
    // Intercept and modify headers to bypass CSP and add popup blocking
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        const responseHeaders = details.responseHeaders || {};
        const url = details.url.toLowerCase();
        
        // Log header modifications for debugging
        if (url.includes('popup') || url.includes('ad')) {
            console.log('🔍 Modifying headers for suspicious URL:', details.url);
        }
        
        // Remove all CSP-related headers
        delete responseHeaders['content-security-policy'];
        delete responseHeaders['Content-Security-Policy'];
        delete responseHeaders['x-frame-options'];
        delete responseHeaders['X-Frame-Options'];
        delete responseHeaders['x-content-type-options'];
        delete responseHeaders['X-Content-Type-Options'];
        delete responseHeaders['referrer-policy'];
        delete responseHeaders['Referrer-Policy'];
        
        // Add aggressive CSP to block popups while allowing iframe content
        responseHeaders['Content-Security-Policy'] = [
            "default-src 'self' 'unsafe-inline' 'unsafe-eval' * data: blob:; " +
            "font-src 'self' data: * blob:; " +
            "img-src 'self' data: * blob:; " +
            "object-src 'none'; " +
            "frame-src *; " +
            "child-src *; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' * blob:; " +
            "style-src 'self' 'unsafe-inline' * blob:; " +
            "connect-src 'self' * blob:; " +
            "media-src 'self' * blob:; " +
            "worker-src 'self' blob: https:; " +
            "manifest-src 'self' data: blob: file: https:; " +
            "base-uri 'self'; " +
            "form-action 'self' *;"
        ];
        
        // Add Permissions-Policy to block popup-related features
        responseHeaders['Permissions-Policy'] = [
            "fullscreen=(), " +
            "payment=(), " +
            "window-management=(), " +
            "display-capture=(), " +
            "screen-wake-lock=(), " +
            "popup=(), " +
            "cross-origin-isolated=()"
        ];
        
        // Remove ALL existing CORS headers to prevent duplicates
        Object.keys(responseHeaders).forEach(key => {
            if (key.toLowerCase().includes('access-control-allow')) {
                delete responseHeaders[key];
            }
        });
        
        // Add single CORS headers as strings (not arrays) to prevent multiple values error
        responseHeaders['Access-Control-Allow-Origin'] = '*';
        responseHeaders['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
        responseHeaders['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
        responseHeaders['Access-Control-Allow-Credentials'] = 'true';
        
        callback({ responseHeaders });
    });
    
    // Also handle before-send-headers to modify request headers
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        const requestHeaders = details.requestHeaders || {};
        
        // Add headers to bypass restrictions
        requestHeaders['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        requestHeaders['Sec-Fetch-Dest'] = 'document';
        requestHeaders['Sec-Fetch-Mode'] = 'navigate';
        requestHeaders['Sec-Fetch-Site'] = 'none';
        requestHeaders['Origin'] = 'https://clearfeed.app';
        requestHeaders['Referer'] = 'https://clearfeed.app/';
        
        // Remove tracking headers
        delete requestHeaders['X-Requested-With'];
        delete requestHeaders['X-Forwarded-For'];
        
        callback({ requestHeaders });
    });
    
    console.log('✅ CSP bypass, ad blocking, and popup blocking configured, creating window...');
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// Handle graceful shutdown of database connection
app.on('before-quit', () => {
    console.log('Closing database connection...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        }
    });
});