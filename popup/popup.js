// Gestione stato dell'estensione
let currentData = {
  cookies: [],
  localStorage: {},
  sessionStorage: {}
};

let currentTab = null;
let currentLanguage = 'en';
let currentFilters = {
  cookies: '',
  localStorage: '',
  sessionStorage: ''
};

// Inizializzazione
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup initialized');
  await loadLanguage();
  initializeTabs();
  await getCurrentTab();
  await loadAllData();
  setupEventListeners();
});

// Carica la lingua salvata o rileva dal browser
async function loadLanguage() {
  try {
    const result = await chrome.storage.local.get(['language']);
    if (result.language) {
      currentLanguage = result.language;
    } else {
      const browserLang = navigator.language.split('-')[0];
      const supportedLangs = ['en', 'it', 'es', 'fr', 'de', 'pl', 'uk', 'ro', 'bg', 'sl', 'pt'];
      currentLanguage = supportedLangs.includes(browserLang) ? browserLang : 'en';
    }
    
    const langSelect = document.getElementById('languageSelect');
    if (langSelect) {
      langSelect.value = currentLanguage;
    }
    
    await updateUITexts();
  } catch (error) {
    console.error('Error loading language:', error);
  }
}

// Aggiorna testi UI in base alla lingua
async function updateUITexts() {
  try {
    const response = await fetch(chrome.runtime.getURL(`_locales/${currentLanguage}/messages.json`));
    const messages = await response.json();
    
    // Mappa tutti gli elementi da tradurre
    const translations = {
      'title': 'extensionName',
      'tabCookies': 'tabCookies',
      'tabLocalStorage': 'tabLocalStorage',
      'tabSessionStorage': 'tabSessionStorage',
      'tabAll': 'tabAll',
      'refreshCookies': 'refresh',
      'refreshLocalStorage': 'refresh',
      'refreshSessionStorage': 'refresh',
      'refreshAll': 'refresh',
      'copyCookies': 'copy',
      'copyLocalStorage': 'copy',
      'copySessionStorage': 'copy',
      'copyAll': 'copy',
      'exportCookies': 'export',
      'exportLocalStorage': 'export',
      'exportSessionStorage': 'export',
      'exportAll': 'export'
    };
    
    for (const [id, key] of Object.entries(translations)) {
      const element = document.getElementById(id);
      if (element && messages[key]) {
        if (id.startsWith('refresh')) {
          element.innerHTML = `🔄 ${messages[key].message}`;
        } else if (id.startsWith('copy')) {
          element.innerHTML = `📋 ${messages[key].message}`;
        } else if (id.startsWith('export')) {
          element.innerHTML = `💾 ${messages[key].message}`;
        } else if (id.startsWith('tab')) {
          const emoji = element.textContent.trim().split(' ')[0];
          element.textContent = `${emoji} ${messages[key].message}`;
        } else {
          element.textContent = messages[key].message;
        }
      }
    }
    
    // Placeholder ricerca
    const searchInputs = document.querySelectorAll('.search-input');
    searchInputs.forEach(input => {
      if (messages.search) {
        input.placeholder = messages.search.message;
      }
    });
    
  } catch (error) {
    console.error('Error loading translations:', error);
  }
}

// Inizializza tabs
function initializeTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.dataset.tab;
      switchTab(tabName);
    });
  });
}

function switchTab(tabName) {
  // Aggiorna bottoni
  document.querySelectorAll('.tab-button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  
  // Mappa i nomi agli ID corretti
  const paneMap = {
    'cookies': 'cookiesContent',
    'localStorage': 'localStorageContent',
    'sessionStorage': 'sessionStorageContent',
    'all': 'allContent'
  };
  
  // Aggiorna contenuti
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === paneMap[tabName]);
  });
}

// Ottieni tab corrente
async function getCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;
    
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo && tab && tab.url) {
      try {
        const url = new URL(tab.url);
        pageInfo.textContent = `${url.hostname}`;
      } catch (e) {
        pageInfo.textContent = tab.url || 'Unknown page';
      }
    }
  } catch (error) {
    console.error('Error getting current tab:', error);
    showStatus('Error getting current tab', 'error');
  }
}

// Carica tutti i dati
async function loadAllData() {
  showStatus('Loading data...', 'info');
  
  try {
    if (!currentTab || !currentTab.id) {
      throw new Error('No active tab');
    }

    // Richiedi dati al background
    const response = await chrome.runtime.sendMessage({
      action: 'getAllData',
      tabId: currentTab.id,
      url: currentTab.url
    });

    console.log('Response from background:', response);
    
    if (response && response.data) {
      currentData = {
        cookies: response.data.cookies || [],
        localStorage: response.data.localStorage || {},
        sessionStorage: response.data.sessionStorage || {},
        timestamp: Date.now()
      };
      
      console.log('Data loaded - Cookies:', currentData.cookies.length,
                  'LS:', Object.keys(currentData.localStorage).length,
                  'SS:', Object.keys(currentData.sessionStorage).length);
      
      updateAllDisplays();
      
      const totalItems = currentData.cookies.length + 
                        Object.keys(currentData.localStorage).length + 
                        Object.keys(currentData.sessionStorage).length;
      
      showStatus(`Data loaded successfully (${totalItems} items)`, 'success');
    } else if (response && response.error) {
      throw new Error(response.error);
    } else {
      throw new Error('No data received');
    }
  } catch (error) {
    console.error('Error loading data:', error);
    showStatus(`Error: ${error.message}`, 'error');
    
    currentData = { cookies: [], localStorage: {}, sessionStorage: {} };
    updateAllDisplays();
  }
}

// Aggiorna tutti i display
function updateAllDisplays() {
  displayCookies(currentData.cookies || []);
  displayLocalStorage(currentData.localStorage || {});
  displaySessionStorage(currentData.sessionStorage || {});
  displayAllData();
}

// Display functions
function displayCookies(cookies) {
  const container = document.getElementById('cookiesList');
  if (!container) return;
  
  const searchTerm = currentFilters.cookies.toLowerCase();
  const filteredCookies = cookies.filter(cookie => 
    !searchTerm || 
    (cookie.name || '').toLowerCase().includes(searchTerm) || 
    (cookie.value || '').toLowerCase().includes(searchTerm) ||
    (cookie.domain || '').toLowerCase().includes(searchTerm)
  );
  
  if (!filteredCookies || filteredCookies.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🍪</div>
        <p>${searchTerm ? 'No matching cookies found' : 'No cookies found'}</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = filteredCookies.map(cookie => `
    <div class="data-item">
      <div class="data-item-header">
        <span class="data-item-name" title="${escapeHtml(cookie.name)}">${escapeHtml(truncate(cookie.name, 30))}</span>
        <div class="cookie-actions">
          <button class="icon-btn copy-cookie" data-value="${escapeHtml(cookie.value)}" title="Copy value">📋</button>
        </div>
      </div>
      <div class="data-item-value" title="${escapeHtml(cookie.value)}">${escapeHtml(truncate(cookie.value, 50))}</div>
      <div class="cookie-details">
        <div class="cookie-detail">🌐 ${escapeHtml(truncate(cookie.domain, 20))}</div>
        <div class="cookie-detail">📁 ${escapeHtml(truncate(cookie.path, 20))}</div>
        <div class="cookie-detail">🔒 ${cookie.secure ? '✓' : '✗'}</div>
        <div class="cookie-detail">🛡️ ${cookie.httpOnly ? '✓' : '✗'}</div>
        <div class="cookie-detail">🔗 ${cookie.sameSite || 'None'}</div>
        ${cookie.expirationDate ? 
          `<div class="cookie-detail">⏰ ${new Date(cookie.expirationDate * 1000).toLocaleDateString()}</div>` : 
          '<div class="cookie-detail">🔄 Session</div>'
        }
      </div>
    </div>
  `).join('');
  
  container.querySelectorAll('.copy-cookie').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboardText(btn.dataset.value);
    });
  });
}

function displayLocalStorage(data) {
  const container = document.getElementById('localStorageList');
  if (!container) return;
  
  // Assicurati che data sia un oggetto valido
  const safeData = data || {};
  const searchTerm = currentFilters.localStorage.toLowerCase();
  const entries = Object.entries(safeData);
  const filteredEntries = entries.filter(([key, value]) => 
    !searchTerm || 
    key.toLowerCase().includes(searchTerm) || 
    String(value).toLowerCase().includes(searchTerm)
  );
  
  if (filteredEntries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💾</div>
        <p>${searchTerm ? 'No matching items found' : 'No localStorage data found'}</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = filteredEntries.map(([key, value]) => `
    <div class="data-item">
      <div class="data-item-header">
        <span class="data-item-name" title="${escapeHtml(key)}">${escapeHtml(truncate(key, 40))}</span>
        <div class="cookie-actions">
          <button class="icon-btn copy-storage" data-value="${escapeHtml(String(value))}" title="Copy value">📋</button>
        </div>
      </div>
      <div class="data-item-value" title="${escapeHtml(String(value))}">${escapeHtml(truncate(String(value), 100))}</div>
      <div class="storage-meta">
        <span class="storage-type">Type: ${typeof value}</span>
        <span class="storage-size">Size: ${new Blob([String(value)]).size} bytes</span>
      </div>
    </div>
  `).join('');
  
  container.querySelectorAll('.copy-storage').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboardText(btn.dataset.value);
    });
  });
}

function displaySessionStorage(data) {
  const container = document.getElementById('sessionStorageList');
  if (!container) return;
  
  // Assicurati che data sia un oggetto valido
  const safeData = data || {};
  const searchTerm = currentFilters.sessionStorage.toLowerCase();
  const entries = Object.entries(safeData);
  const filteredEntries = entries.filter(([key, value]) => 
    !searchTerm || 
    key.toLowerCase().includes(searchTerm) || 
    String(value).toLowerCase().includes(searchTerm)
  );
  
  if (filteredEntries.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <p>${searchTerm ? 'No matching items found' : 'No sessionStorage data found'}</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = filteredEntries.map(([key, value]) => `
    <div class="data-item">
      <div class="data-item-header">
        <span class="data-item-name" title="${escapeHtml(key)}">${escapeHtml(truncate(key, 40))}</span>
        <div class="cookie-actions">
          <button class="icon-btn copy-session" data-value="${escapeHtml(String(value))}" title="Copy value">📋</button>
        </div>
      </div>
      <div class="data-item-value" title="${escapeHtml(String(value))}">${escapeHtml(truncate(String(value), 100))}</div>
      <div class="storage-meta">
        <span class="storage-type">Type: ${typeof value}</span>
        <span class="storage-size">Size: ${new Blob([String(value)]).size} bytes</span>
      </div>
    </div>
  `).join('');
  
  container.querySelectorAll('.copy-session').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboardText(btn.dataset.value);
    });
  });
}

function displayAllData() {
  const container = document.getElementById('allDataList');
  if (!container) return;
  
  const cookies = currentData.cookies || [];
  const localStorage = currentData.localStorage || {};
  const sessionStorage = currentData.sessionStorage || {};
  
  const totalItems = cookies.length + Object.keys(localStorage).length + Object.keys(sessionStorage).length;
  
  container.innerHTML = `
    <div class="summary-stats">
      <div class="stat-card">
        <div class="stat-icon">🍪</div>
        <div class="stat-value">${cookies.length}</div>
        <div class="stat-label">Cookies</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">💾</div>
        <div class="stat-value">${Object.keys(localStorage).length}</div>
        <div class="stat-label">LocalStorage</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📦</div>
        <div class="stat-value">${Object.keys(sessionStorage).length}</div>
        <div class="stat-label">SessionStorage</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-value">${totalItems}</div>
        <div class="stat-label">Total Items</div>
      </div>
    </div>
    
    <div class="data-section">
      <h3>🍪 Cookies (${cookies.length})</h3>
      ${cookies.length > 0 ? 
        `<div class="compact-list">
          ${cookies.slice(0, 10).map(c => `
            <div class="compact-item">
              <span class="compact-name">${escapeHtml(truncate(c.name, 20))}:</span>
              <span class="compact-value">${escapeHtml(truncate(c.value, 30))}</span>
            </div>
          `).join('')}
          ${cookies.length > 10 ? `<div class="more-items">... and ${cookies.length - 10} more</div>` : ''}
        </div>` :
        '<p class="no-data">No cookies found</p>'
      }
    </div>
    
    <div class="data-section">
      <h3>💾 LocalStorage (${Object.keys(localStorage).length})</h3>
      ${Object.keys(localStorage).length > 0 ?
        `<div class="compact-list">
          ${Object.entries(localStorage).slice(0, 10).map(([k, v]) => `
            <div class="compact-item">
              <span class="compact-name">${escapeHtml(truncate(k, 20))}:</span>
              <span class="compact-value">${escapeHtml(truncate(String(v), 30))}</span>
            </div>
          `).join('')}
          ${Object.keys(localStorage).length > 10 ? `<div class="more-items">... and ${Object.keys(localStorage).length - 10} more</div>` : ''}
        </div>` :
        '<p class="no-data">No localStorage data</p>'
      }
    </div>
    
    <div class="data-section">
      <h3>📦 SessionStorage (${Object.keys(sessionStorage).length})</h3>
      ${Object.keys(sessionStorage).length > 0 ?
        `<div class="compact-list">
          ${Object.entries(sessionStorage).slice(0, 10).map(([k, v]) => `
            <div class="compact-item">
              <span class="compact-name">${escapeHtml(truncate(k, 20))}:</span>
              <span class="compact-value">${escapeHtml(truncate(String(v), 30))}</span>
            </div>
          `).join('')}
          ${Object.keys(sessionStorage).length > 10 ? `<div class="more-items">... and ${Object.keys(sessionStorage).length - 10} more</div>` : ''}
        </div>` :
        '<p class="no-data">No sessionStorage data</p>'
      }
    </div>
  `;
}

// Utility functions
function escapeHtml(text) {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

function truncate(text, maxLength) {
  if (!text) return '';
  const str = String(text);
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

function showStatus(message, type = 'info') {
  const status = document.getElementById('status');
  if (!status) return;
  
  status.textContent = message;
  status.className = `status ${type}`;
  
  if (type === 'success' || type === 'error') {
    setTimeout(() => {
      if (status.textContent === message) {
        status.textContent = '';
        status.className = 'status';
      }
    }, 3000);
  }
}

async function copyToClipboardText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showStatus('Copied to clipboard!', 'success');
  } catch (error) {
    // Fallback per browser più vecchi
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showStatus('Copied to clipboard!', 'success');
  }
}

async function copyAllData(type) {
  let text = '';
  
  switch(type) {
    case 'cookies':
      text = JSON.stringify(currentData.cookies || [], null, 2);
      break;
    case 'localStorage':
      text = JSON.stringify(currentData.localStorage || {}, null, 2);
      break;
    case 'sessionStorage':
      text = JSON.stringify(currentData.sessionStorage || {}, null, 2);
      break;
    case 'all':
      text = JSON.stringify({
        url: currentTab?.url,
        timestamp: new Date().toISOString(),
        cookies: currentData.cookies,
        localStorage: currentData.localStorage,
        sessionStorage: currentData.sessionStorage
      }, null, 2);
      break;
  }
  
  await copyToClipboardText(text);
}

function exportData(type) {
  let data = {};
  let filename = '';
  const hostname = currentTab?.url ? new URL(currentTab.url).hostname : 'unknown';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  switch(type) {
    case 'cookies':
      data = currentData.cookies || [];
      filename = `cookies_${hostname}_${timestamp}.json`;
      break;
    case 'localStorage':
      data = currentData.localStorage || {};
      filename = `localStorage_${hostname}_${timestamp}.json`;
      break;
    case 'sessionStorage':
      data = currentData.sessionStorage || {};
      filename = `sessionStorage_${hostname}_${timestamp}.json`;
      break;
    case 'all':
      data = {
        url: currentTab?.url,
        title: currentTab?.title,
        timestamp: new Date().toISOString(),
        cookies: currentData.cookies,
        localStorage: currentData.localStorage,
        sessionStorage: currentData.sessionStorage
      };
      filename = `all_data_${hostname}_${timestamp}.json`;
      break;
  }
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  
  showStatus(`Exported ${filename}`, 'success');
}

function setupEventListeners() {
  // Language selector
  document.getElementById('languageSelect')?.addEventListener('change', async (e) => {
    currentLanguage = e.target.value;
    await chrome.storage.local.set({ language: currentLanguage });
    await updateUITexts();
    showStatus('Language updated', 'success');
  });
  
  // Refresh buttons
  document.getElementById('refreshCookies')?.addEventListener('click', loadAllData);
  document.getElementById('refreshLocalStorage')?.addEventListener('click', loadAllData);
  document.getElementById('refreshSessionStorage')?.addEventListener('click', loadAllData);
  document.getElementById('refreshAll')?.addEventListener('click', loadAllData);
  
  // Copy buttons
  document.getElementById('copyCookies')?.addEventListener('click', () => copyAllData('cookies'));
  document.getElementById('copyLocalStorage')?.addEventListener('click', () => copyAllData('localStorage'));
  document.getElementById('copySessionStorage')?.addEventListener('click', () => copyAllData('sessionStorage'));
  document.getElementById('copyAll')?.addEventListener('click', () => copyAllData('all'));
  
  // Export buttons
  document.getElementById('exportCookies')?.addEventListener('click', () => exportData('cookies'));
  document.getElementById('exportLocalStorage')?.addEventListener('click', () => exportData('localStorage'));
  document.getElementById('exportSessionStorage')?.addEventListener('click', () => exportData('sessionStorage'));
  document.getElementById('exportAll')?.addEventListener('click', () => exportData('all'));
  
  // Search
  document.getElementById('cookieSearch')?.addEventListener('input', (e) => {
    currentFilters.cookies = e.target.value;
    displayCookies(currentData.cookies || []);
  });
  
  document.getElementById('localSearch')?.addEventListener('input', (e) => {
    currentFilters.localStorage = e.target.value;
    displayLocalStorage(currentData.localStorage || {});
  });
  
  document.getElementById('sessionSearch')?.addEventListener('input', (e) => {
    currentFilters.sessionStorage = e.target.value;
    displaySessionStorage(currentData.sessionStorage || {});
  });
}

// Ascolta messaggi dal background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'dataReady') {
    console.log('Data ready message received:', request);
    if (request.data) {
      currentData = {
        cookies: request.data.cookies || [],
        localStorage: request.data.localStorage || {},
        sessionStorage: request.data.sessionStorage || {},
        timestamp: Date.now()
      };
      
      updateAllDisplays();
      
      if (request.data.cookies?.length > 0) {
        switchTab('cookies');
      } else if (Object.keys(request.data.localStorage || {}).length > 0) {
        switchTab('localStorage');
      } else if (Object.keys(request.data.sessionStorage || {}).length > 0) {
        switchTab('sessionStorage');
      }
      
      showStatus('Data updated from context menu!', 'success');
    }
    sendResponse({ received: true });
  }
  return true;
});

console.log('Popup script loaded');