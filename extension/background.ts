console.log("Background script loaded")

// Listen for screenshot capture requests
chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    console.log("Background received message:", request)
    
    // Check for msg property as used in the content script
    if (request.msg === "capture") {
      console.log("Attempting to capture screenshot...")
      
      chrome.tabs.captureVisibleTab(
        null,
        { format: "png", quality: 100 },
        function(dataUrl) {
          if (dataUrl) {  
            console.log("Screenshot captured, length:", dataUrl.length)
            sendResponse({success: true, dataUrl: dataUrl});
          } else {
            console.error("No screenshot data returned")
            sendResponse({success: false, error: "No screenshot data returned"});
          }
        }
      );
      
      // Return true to indicate we'll send a response asynchronously
      return true;
    }
  }
);