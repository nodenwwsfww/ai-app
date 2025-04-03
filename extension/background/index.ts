import type { TabScreenshot } from "./types";

export const tabScreenshots = new Map<number, TabScreenshot>();

// Listen for when the extension is installed
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Open the welcome page when the extension is first installed
    chrome.tabs.create({
      url: chrome.runtime.getURL("tabs/welcome.html")
    });
  }
});

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabScreenshots.delete(tabId);
}); 