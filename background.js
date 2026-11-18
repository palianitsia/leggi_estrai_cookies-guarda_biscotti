// Service worker per gestione in background
console.log('Background service worker started');

// Inizializza menu contestuale all'installazione
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed, creating context menus');
  createContextMenus();
});

// Ricrea i menu quando il service worker si avvia
chrome.runtime.onStartup.addListener(() => {
  console.log('Browser started, recreating context menus');
  createContextMenus();
});

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    if (chrome.runtime.lastError) {
      console.error('Error removing menus:', chrome.runtime.lastError);
    }
    
    try {
      chrome.contextMenus.create({
        id: "getCookies",
        title: "🍪 Get Cookies",
        contexts: ["page"]
      });
      
      chrome.contextMenus.create({
        id: "getLocalStorage",
        title: "💾 Get LocalStorage",
        contexts: ["page"]
      });
      
      chrome.contextMenus.create({
        id: "getSessionStorage",
        title: "📦 Get SessionStorage",
        contexts: ["page"]
      });
      
      chrome.contextMenus.create({
        id: "getAll",
        title: "📋 Get All Data",
        contexts: ["page"]
      });
      
      chrome.contextMenus.create({
        id: "separator1",
        type: "separator",
        contexts: ["page"]
      });
      
      chrome.contextMenus.create({
        id: "copyCookiesToClipboard",
        title: "📋 Copy Cookies to Clipboard",
        contexts: ["page"]
      });
      
      chrome.contextMenus.create({
        id: "exportCookies",
        title: "💾 Export Cookies as JSON",
        contexts: ["page"]
      });
      
      console.log('Context menus created successfully');
    } catch (error) {
      console.error('Error creating context menus:', error);
    }
  });
}

// Gestione click menu contestuale
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log('Context menu clicked:', info.menuItemId, 'on tab:', tab?.id);
  
  if (!tab || !tab.id) {
    console.error('No valid tab');
    return;
  }
  
  try {
    switch (info.menuItemId) {
      case "getCookies":
        await handleGetCookies(tab);
        break;
      case "getLocalStorage":
        await handleGetLocalStorage(tab);
        break;
      case "getSessionStorage":
        await handleGetSessionStorage(tab);
        break;
      case "getAll":
        await handleGetAll(tab);
        break;
      case "copyCookiesToClipboard":
        await handleCopyCookies(tab);
        break;
      case "exportCookies":
        await handleExportCookies(tab);
        break;
    }
  } catch (error) {
    console.error('Error handling context menu click:', error);
    showNotification('Error', 'Failed to get data: ' + error.message);
  }
});

// Funzioni handler per i menu
async function handleGetCookies(tab) {
  try {
    const cookies = await chrome.cookies.getAll({ url: tab.url });
    console.log('Cookies retrieved:', cookies.length);
    
    await saveDataAndShow({ cookies: cookies }, tab, 'Cookies');
    showNotification('Cookies Retrieved', `Found ${cookies.length} cookies`);
  } catch (error) {
    console.error('Error getting cookies:', error);
    throw error;
  }
}

async function handleGetLocalStorage(tab) {
  try {
    // Verifica che il tab sia valido e accessibile
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
      throw new Error('Cannot access localStorage on this page');
    }
    
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const items = {};
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
              items[key] = localStorage.getItem(key);
            }
          }
        } catch (e) {
          console.error('Error reading localStorage:', e);
          return { error: e.message };
        }
        return items;
      }
    });
    
    if (!results || !results[0]) {
      throw new Error('No result from script execution');
    }
    
    const localStorage = results[0].result;
    
    // Controlla se c'è stato un errore nell'esecuzione
    if (localStorage && localStorage.error) {
      throw new Error(localStorage.error);
    }
    
    const count = Object.keys(localStorage || {}).length;
    console.log('LocalStorage retrieved:', count);
    
    await saveDataAndShow({ localStorage: localStorage || {} }, tab, 'LocalStorage');
    showNotification('LocalStorage Retrieved', `Found ${count} items`);
  } catch (error) {
    console.error('Error getting localStorage:', error);
    showNotification('Error', `Failed to get localStorage: ${error.message}`);
    throw error;
  }
}

async function handleGetSessionStorage(tab) {
  try {
    // Verifica che il tab sia valido e accessibile
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
      throw new Error('Cannot access sessionStorage on this page');
    }
    
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const items = {};
        try {
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key) {
              items[key] = sessionStorage.getItem(key);
            }
          }
        } catch (e) {
          console.error('Error reading sessionStorage:', e);
          return { error: e.message };
        }
        return items;
      }
    });
    
    if (!results || !results[0]) {
      throw new Error('No result from script execution');
    }
    
    const sessionStorage = results[0].result;
    
    // Controlla se c'è stato un errore nell'esecuzione
    if (sessionStorage && sessionStorage.error) {
      throw new Error(sessionStorage.error);
    }
    
    const count = Object.keys(sessionStorage || {}).length;
    console.log('SessionStorage retrieved:', count);
    
    await saveDataAndShow({ sessionStorage: sessionStorage || {} }, tab, 'SessionStorage');
    showNotification('SessionStorage Retrieved', `Found ${count} items`);
  } catch (error) {
    console.error('Error getting sessionStorage:', error);
    showNotification('Error', `Failed to get sessionStorage: ${error.message}`);
    throw error;
  }
}

async function handleGetAll(tab) {
  try {
    // Verifica che il tab sia valido e accessibile
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) {
      throw new Error('Cannot access data on this page');
    }
    
    const [cookies, storageResults] = await Promise.all([
      chrome.cookies.getAll({ url: tab.url }),
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const localStorageData = {};
          const sessionStorageData = {};
          
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key) {
                localStorageData[key] = localStorage.getItem(key);
              }
            }
          } catch (e) {
            console.error('Error reading localStorage:', e);
          }
          
          try {
            for (let i = 0; i < sessionStorage.length; i++) {
              const key = sessionStorage.key(i);
              if (key) {
                sessionStorageData[key] = sessionStorage.getItem(key);
              }
            }
          } catch (e) {
            console.error('Error reading sessionStorage:', e);
          }
          
          return { localStorage: localStorageData, sessionStorage: sessionStorageData };
        }
      })
    ]);
    
    // Verifica che i risultati siano validi
    const localStorageData = storageResults && storageResults[0] && storageResults[0].result 
      ? storageResults[0].result.localStorage 
      : {};
    const sessionStorageData = storageResults && storageResults[0] && storageResults[0].result 
      ? storageResults[0].result.sessionStorage 
      : {};
    
    const data = {
      cookies: cookies || [],
      localStorage: localStorageData,
      sessionStorage: sessionStorageData
    };
    
    console.log('All data retrieved - Cookies:', cookies.length, 
                'LS:', Object.keys(localStorageData).length, 
                'SS:', Object.keys(sessionStorageData).length);
    
    await saveDataAndShow(data, tab, 'All Data');
    showNotification('All Data Retrieved', `Cookies: ${cookies.length}, LS: ${Object.keys(localStorageData).length}, SS: ${Object.keys(sessionStorageData).length}`);
  } catch (error) {
    console.error('Error getting all data:', error);
    showNotification('Error', `Failed to get data: ${error.message}`);
    throw error;
  }
}

async function handleCopyCookies(tab) {
  try {
    const cookies = await chrome.cookies.getAll({ url: tab.url });
    const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (text) => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      },
      args: [cookieString]
    });
    
    showNotification('Copied!', `${cookies.length} cookies copied to clipboard`);
  } catch (error) {
    console.error('Error copying cookies:', error);
    throw error;
  }
}

async function handleExportCookies(tab) {
  try {
    const cookies = await chrome.cookies.getAll({ url: tab.url });
    const jsonData = JSON.stringify(cookies, null, 2);
    const filename = `cookies_${new URL(tab.url).hostname}_${Date.now()}.json`;
    
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (data, fname) => {
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fname;
        a.click();
        URL.revokeObjectURL(url);
      },
      args: [jsonData, filename]
    });
    
    showNotification('Exported!', `${cookies.length} cookies exported to ${filename}`);
  } catch (error) {
    console.error('Error exporting cookies:', error);
    throw error;
  }
}

// Salva i dati e mostra la finestra popup
async function saveDataAndShow(data, tab, dataType) {
  // Salva in storage
  await chrome.storage.local.set({ 
    [`tabData_${tab.id}`]: {
      ...data,
      url: tab.url,
      title: tab.title,
      dataType: dataType,
      timestamp: Date.now()
    }
  });
  
  // Apri la finestra di visualizzazione
  const popupUrl = chrome.runtime.getURL('viewer/viewer.html') + `?tabId=${tab.id}&type=${encodeURIComponent(dataType)}`;
  
  // Cerca se c'è già una finestra aperta per questa estensione
  const existingWindows = await chrome.windows.getAll({ populate: true });
  const viewerWindow = existingWindows.find(w => 
    w.tabs?.some(t => t.url?.includes('viewer/viewer.html'))
  );
  
  if (viewerWindow) {
    // Aggiorna la scheda esistente
    const viewerTab = viewerWindow.tabs.find(t => t.url?.includes('viewer/viewer.html'));
    if (viewerTab) {
      await chrome.tabs.update(viewerTab.id, { url: popupUrl, active: true });
      await chrome.windows.update(viewerWindow.id, { focused: true });
    }
  } else {
    // Crea una nuova finestra
    await chrome.windows.create({
      url: popupUrl,
      type: 'popup',
      width: 550,
      height: 600,
      focused: true
    });
  }
  
  // Notifica anche il popup se è aperto
  chrome.runtime.sendMessage({
    action: 'dataReady',
    data: data,
    tabId: tab.id
  }).catch(() => {});
}

function showNotification(title, message) {
  try {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: title,
      message: message,
      priority: 1
    });
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}

// Gestione messaggi dal popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request.action);
  
  if (request.action === 'getAllData') {
    handleGetAllData(request.tabId, request.url).then(data => {
      console.log('Sending data back to popup:', {
        cookies: data.cookies?.length,
        localStorage: Object.keys(data.localStorage || {}).length,
        sessionStorage: Object.keys(data.sessionStorage || {}).length
      });
      sendResponse({ data: data });
    }).catch(error => {
      console.error('Error in getAllData:', error);
      sendResponse({ 
        data: { cookies: [], localStorage: {}, sessionStorage: {} },
        error: error.message 
      });
    });
    return true;
  }
  
  if (request.action === 'getStoredData') {
    chrome.storage.local.get([`tabData_${request.tabId}`]).then(result => {
      sendResponse({ data: result[`tabData_${request.tabId}`] || null });
    });
    return true;
  }
});

async function handleGetAllData(tabId, url) {
  const data = {
    cookies: [],
    localStorage: {},
    sessionStorage: {}
  };
  
  try {
    // Verifica che il tab sia valido
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab) {
      console.error('Tab not found:', tabId);
      return data;
    }
    
    // Verifica se possiamo accedere alla pagina
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url === 'about:blank')) {
      console.warn('Cannot access data on this page:', tab.url);
      return data;
    }
    
    // Ottieni cookies
    if (url) {
      try {
        data.cookies = await chrome.cookies.getAll({ url: url });
        console.log('Cookies retrieved:', data.cookies.length);
      } catch (cookieError) {
        console.error('Error getting cookies:', cookieError);
      }
    }
    
    // Ottieni localStorage e sessionStorage
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          const localStorageData = {};
          const sessionStorageData = {};
          
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key) {
                localStorageData[key] = localStorage.getItem(key);
              }
            }
          } catch (e) {
            console.error('Error reading localStorage in script:', e);
          }
          
          try {
            for (let i = 0; i < sessionStorage.length; i++) {
              const key = sessionStorage.key(i);
              if (key) {
                sessionStorageData[key] = sessionStorage.getItem(key);
              }
            }
          } catch (e) {
            console.error('Error reading sessionStorage in script:', e);
          }
          
          return { localStorage: localStorageData, sessionStorage: sessionStorageData };
        }
      });
      
      if (results && results[0] && results[0].result) {
        data.localStorage = results[0].result.localStorage || {};
        data.sessionStorage = results[0].result.sessionStorage || {};
        console.log('Storage retrieved - LS:', Object.keys(data.localStorage).length, 
                    'SS:', Object.keys(data.sessionStorage).length);
      } else {
        console.warn('No results from script execution');
      }
    } catch (scriptError) {
      console.error('Could not execute script on this page:', scriptError);
      // Non fallire completamente, restituisci almeno i cookies
    }
  } catch (error) {
    console.error('Error in handleGetAllData:', error);
  }
  
  return data;
}

console.log('Background service worker fully initialized');