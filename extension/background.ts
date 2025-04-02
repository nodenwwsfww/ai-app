interface TabScreenshot {
  screenshot: string;
  timestamp: number;
}

const tabScreenshots = new Map<number, TabScreenshot>();

// Listen for when the extension is installed
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Open the welcome page when the extension is first installed
    chrome.tabs.create({
      url: chrome.runtime.getURL("tabs/welcome.html")
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!sender.tab?.id) return;

  switch (request.type) {
    case 'STORE_SCREENSHOT':
      tabScreenshots.set(sender.tab.id, {
        screenshot: request.screenshot,
        timestamp: Date.now()
      });
      sendResponse({ success: true });
      break;

    case 'GET_SCREENSHOT':
      const data = tabScreenshots.get(sender.tab.id);
      sendResponse({ screenshot: data?.screenshot });
      break;

    case 'HAS_SCREENSHOT':
      sendResponse({ hasScreenshot: tabScreenshots.has(sender.tab.id) });
      break;
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabScreenshots.delete(tabId);
});
