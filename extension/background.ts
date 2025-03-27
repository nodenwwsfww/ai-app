console.log("Background script loaded")

// Listen for screenshot capture requests
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Background received message:", message)
  
  if (message.action === "captureVisibleTab") {
    console.log("Attempting to capture screenshot...")
    
    try {
      // Use a simple approach without options for better compatibility
      chrome.tabs.captureVisibleTab((dataUrl) => {
        if (chrome.runtime.lastError) {
          console.error("Screenshot error:", chrome.runtime.lastError)
          sendResponse({ success: false, error: chrome.runtime.lastError.message })
        } else if (!dataUrl) {
          console.error("No screenshot data returned")
          sendResponse({ success: false, error: "No screenshot data returned" })
        } else {
          console.log("Screenshot captured successfully, length:", dataUrl.length)
          sendResponse({ success: true, dataUrl })
        }
      })
    } catch (error) {
      console.error("Exception during captureVisibleTab:", error)
      sendResponse({ success: false, error: String(error) })
    }
    
    // Return true to indicate we'll send a response asynchronously
    return true
  }
}) 