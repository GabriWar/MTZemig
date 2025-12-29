// Background script to handle side panel
chrome.action.onClicked.addListener((tab) => {
  // Open side panel when extension icon is clicked
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Optional: Open side panel automatically on Cemig pages
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && tab.url) {
    if (tab.url.includes('atende.cemig.com.br') ||
        tab.url.includes('atendimento.cemig.com.br')) {
      chrome.sidePanel.setOptions({
        tabId,
        path: 'popup.html',
        enabled: true
      });
    }
  }
});

// Listen for messages from content script and relay to side panel/popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[BACKGROUND] Message received:', message);

  if (message.action === 'NEW_BILL_DATA_CAPTURED') {
    console.log('[BACKGROUND] New bill data captured, notifying all contexts');

    // Broadcast to all extension contexts (including side panel)
    chrome.runtime.sendMessage({
      action: 'RELOAD_BILL_DATA'
    }).catch(err => {
      console.log('[BACKGROUND] No active contexts to notify:', err);
    });
  }

  sendResponse({ status: 'ok' });
  return true; // Keep message channel open for async response
});
