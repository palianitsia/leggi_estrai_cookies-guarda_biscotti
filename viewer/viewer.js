let currentData = null;
let currentTabId = null;

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  currentTabId = urlParams.get('tabId');
  const dataType = urlParams.get('type') || 'Data';
  
  document.getElementById('viewerTitle').textContent = `Get Cookies - ${dataType}`;
  
  await loadData();
  setupEventListeners();
});

async function loadData() {
  try {
    const result = await chrome.storage.local.get([`tabData_${currentTabId}`]);
    const stored = result[`tabData_${currentTabId}`];
    
    if (stored) {
      currentData = stored;
      displayData(stored);
      
      const url = stored.url || 'Unknown';
      const timestamp = stored.timestamp ? new Date(stored.timestamp).toLocaleString() : 'Just now';
      document.getElementById('dataInfo').textContent = `Source: ${url} | Retrieved: ${timestamp}`;
    } else {
      document.getElementById('dataDisplay').textContent = 'No data found';
    }
  } catch (error) {
    console.error('Error loading data:', error);
    document.getElementById('dataDisplay').textContent = 'Error loading data: ' + error.message;
  }
}

function displayData(data) {
  // Rimuovi campi interni per la visualizzazione
  const displayData = { ...data };
  delete displayData.timestamp;
  delete displayData.url;
  delete displayData.title;
  delete displayData.dataType;
  
  document.getElementById('dataDisplay').textContent = JSON.stringify(displayData, null, 2);
}

function setupEventListeners() {
  document.getElementById('closeBtn').addEventListener('click', () => {
    window.close();
  });
  
  document.getElementById('copyBtn').addEventListener('click', async () => {
    try {
      const displayData = { ...currentData };
      delete displayData.timestamp;
      delete displayData.dataType;
      
      await navigator.clipboard.writeText(JSON.stringify(displayData, null, 2));
      showStatus('Copied to clipboard!', 'success');
    } catch (error) {
      showStatus('Failed to copy', 'error');
    }
  });
  
  document.getElementById('exportBtn').addEventListener('click', () => {
    try {
      const displayData = { ...currentData };
      delete displayData.timestamp;
      delete displayData.dataType;
      
      const json = JSON.stringify(displayData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `data_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      showStatus('Exported!', 'success');
    } catch (error) {
      showStatus('Failed to export', 'error');
    }
  });
}

function showStatus(message, type) {
  const footer = document.querySelector('.viewer-footer');
  const statusEl = document.createElement('span');
  statusEl.className = `status ${type}`;
  statusEl.textContent = message;
  
  const existing = footer.querySelector('.status');
  if (existing) existing.remove();
  
  footer.appendChild(statusEl);
  
  setTimeout(() => statusEl.remove(), 3000);
}

// Chiudi la finestra con Esc
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    window.close();
  }
});