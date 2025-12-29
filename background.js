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
