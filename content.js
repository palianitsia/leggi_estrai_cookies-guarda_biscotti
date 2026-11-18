// Content script per aiutare con la comunicazione
console.log('Get Cookies content script loaded');

// Ascolta messaggi dal background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ status: 'ok' });
    return true;
  }
  
  if (request.action === 'getPageInfo') {
    const pageInfo = {
      url: window.location.href,
      title: document.title,
      domain: window.location.hostname,
      protocol: window.location.protocol
    };
    sendResponse(pageInfo);
    return true;
  }
});

// Notifica che il content script è pronto
chrome.runtime.sendMessage({ action: 'contentScriptReady', url: window.location.href });