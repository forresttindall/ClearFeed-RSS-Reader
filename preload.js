const { contextBridge, ipcRenderer, shell } = require('electron');

console.log('=== PRELOAD SCRIPT STARTING ===');
console.log('Process type:', process.type);
console.log('Context isolation enabled:', process.contextIsolated);

// Define the channels we want to expose
const validChannels = [
    'fetch-feeds',
    'fetch-articles',
    'add-feed',
    'mark-as-read',
    'delete-feed',
    'update-feeds',
    'cleanup-database'
];

// Create the API object
const electronAPI = {
    ipcRenderer: {
        invoke: async (channel, data) => {
            if (!validChannels.includes(channel)) {
                throw new Error(`Invalid channel: ${channel}`);
            }
            return await ipcRenderer.invoke(channel, data);
        }
    },
    shell: {
        openExternal: (url) => {
            return shell.openExternal(url);
        }
    }
};

// Create test API
const testAPI = {
    isElectronAvailable: true,
    testAPI: () => ({
        electron: true,
        ipcRenderer: true,
        channels: validChannels
    })
};

// Expose the APIs
try {
    contextBridge.exposeInMainWorld('electron', electronAPI);
    contextBridge.exposeInMainWorld('electronTest', testAPI);
    console.log('Electron bridge exposed successfully');
} catch (error) {
    console.error('Failed to expose electron bridge:', error);
}

console.log('=== PRELOAD SCRIPT COMPLETED ===');
console.log('Window.electron available:', typeof window !== 'undefined' && !!window.electron);

// Add DOM ready debugging
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        console.log('DOM ready, checking electron availability');
        console.log('window.electron:', window.electron);
        console.log('window.electronTest:', window.electronTest);
        console.log('Root element:', document.getElementById('root'));
        console.log('Document body children:', document.body.children.length);
    });
    
    window.addEventListener('load', () => {
        console.log('Window loaded, testing IPC availability');
        if (window.electronTest) {
            console.log('Electron availability check:', window.electronTest.testAPI());
        }
        if (window.electron) {
            console.log('IPC is available in renderer');
            if (window.electronTest) {
                console.log('Test API result:', window.electronTest.testAPI());
            }
        }
        
        // Check if React has mounted
        setTimeout(() => {
            const root = document.getElementById('root');
            console.log('Root element after 2s:', root);
            console.log('Root innerHTML length:', root ? root.innerHTML.length : 'No root');
            console.log('Root has children:', root ? root.children.length : 'No root');
        }, 2000);
    });
}