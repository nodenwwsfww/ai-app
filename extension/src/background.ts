import { STORAGE_KEYS } from "~constants"

import type { TabScreenshot } from "./types"

const tabScreenshots = new Map<number, TabScreenshot>()
let lastActiveTabId: number | null = null

// Listen for when the extension is installed
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Open the welcome page when the extension is first installed
    chrome.tabs.create({
      url: chrome.runtime.getURL("tabs/welcome.html")
    })
  }
})

// Track tab switching to save previous tab's screenshot
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const { tabId } = activeInfo

  // If we have a previous tab and its screenshot, save it to local storage
  if (lastActiveTabId && tabScreenshots.has(lastActiveTabId)) {
    const prevScreenshot = tabScreenshots.get(lastActiveTabId)
    if (prevScreenshot) {
      try {
        await chrome.storage.local.set({
          [STORAGE_KEYS.PREVIOUS_SCREENSHOT]: prevScreenshot.screenshot,
          [STORAGE_KEYS.PREVIOUS_TAB_URL]: prevScreenshot.url
        })
        console.log("Saved previous tab screenshot to local storage")
      } catch (error) {
        console.error("Error saving previous tab screenshot:", error)
      }
    }
  }

  lastActiveTabId = tabId
})

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!sender.tab?.id) return

  let data = null
  let currentData = null

  switch (request.type) {
    case "STORE_SCREENSHOT":
      tabScreenshots.set(sender.tab.id, {
        screenshot: request.screenshot,
        timestamp: Date.now(),
        url: sender.tab.url || ""
      })
      sendResponse({ success: true })
      break

    case "GET_SCREENSHOT":
      data = tabScreenshots.get(sender.tab.id)
      sendResponse({ screenshot: data?.screenshot })
      break

    case "GET_BOTH_SCREENSHOTS":
      // Retrieve current tab screenshot from memory
      currentData = tabScreenshots.get(sender.tab.id)
      // Get previous screenshot data from storage
      chrome.storage.local.get(
        [STORAGE_KEYS.PREVIOUS_SCREENSHOT, STORAGE_KEYS.PREVIOUS_TAB_URL],
        (result) => {
          sendResponse({
            currentScreenshot: currentData?.screenshot || null,
            previousScreenshot:
              result[STORAGE_KEYS.PREVIOUS_SCREENSHOT] || null,
            previousTabUrl: result[STORAGE_KEYS.PREVIOUS_TAB_URL] || null
          })
        }
      )
      return true // Keep the message channel open for the async response

    case "HAS_SCREENSHOT":
      sendResponse({
        hasCurrentScreenshot: tabScreenshots.has(sender.tab.id),
        hasPreviousScreenshot: true // We'll check in storage when needed
      })
      break
  }
})

// Clean up when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  tabScreenshots.delete(tabId)

  // If we're closing the last active tab, clear the reference
  if (lastActiveTabId === tabId) {
    lastActiveTabId = null
  }
})
