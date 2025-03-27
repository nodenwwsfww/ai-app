import React, { useState, useEffect, useRef } from 'react'

function IndexPopup() {
  const [apiUrl, setApiUrl] = useState("")
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [screenshotData, setScreenshotData] = useState("")
  const screenshotContainerRef = useRef(null)

  useEffect(() => {
    // Load saved API URL from storage
    if (chrome.storage?.local) {
      chrome.storage.local.get("apiUrl", (result) => {
        if (result.apiUrl) {
          setApiUrl(result.apiUrl)
        }
      })
    }
  }, [])

  const saveSettings = () => {
    if (chrome.storage?.local) {
      chrome.storage.local.set({ apiUrl }, () => {
        setMessage("Settings saved!")
        setTimeout(() => setMessage(""), 2000)
      })
    }
  }

  const captureAndSendScreenshot = () => {
    setLoading(true)
    setMessage("")
    setScreenshotData("")
    
    try {
      chrome.tabs.captureVisibleTab(async (dataUrl) => {
        if (chrome.runtime.lastError) {
          setMessage("Error: " + chrome.runtime.lastError.message)
          setLoading(false)
          return
        }
        
        setScreenshotData(dataUrl)
        
        try {
          // Get current active tab
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
          
          // Get target API URL
          const targetUrl = apiUrl || "http://localhost:8080/complete"
          
          // Send screenshot to API
          const response = await fetch(targetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: "What's in this screenshot?",
              url: tab.url,
              screenshot: dataUrl
            })
          })
          
          if (response.ok) {
            const data = await response.json()
            setMessage("Screenshot processed successfully!")
          } else {
            setMessage("Error: API returned " + response.status)
          }
        } catch (error) {
          setMessage("Error: " + error.message)
        } finally {
          setLoading(false)
        }
      })
    } catch (error) {
      setMessage("Error: " + error.message)
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        padding: 16,
        width: 300,
        display: "flex",
        flexDirection: "column",
        gap: 8
      }}>
      <h2 style={{ margin: "0 0 8px 0" }}>AI Autocomplete</h2>
      
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label htmlFor="api-url">API URL:</label>
        <input 
          id="api-url"
          type="text"
          style={{ padding: 6, width: "100%" }}
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
        />
      </div>
      
      <button 
        style={{
          marginTop: 8,
          padding: "6px 12px",
          backgroundColor: "#4285f4",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: "pointer"
        }}
        onClick={saveSettings}
      >
        Save Settings
      </button>
      
      <button 
        style={{
          marginTop: 8,
          padding: "8px 12px",
          backgroundColor: "#34a853",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: loading ? "default" : "pointer",
          opacity: loading ? 0.7 : 1
        }}
        onClick={captureAndSendScreenshot}
        disabled={loading}
      >
        {loading ? "Processing..." : "Capture & Send to OpenAI"}
      </button>
      
      {message && (
        <p style={{ 
          fontSize: 12, 
          marginTop: 8, 
          padding: 6,
          backgroundColor: message.startsWith("Error") ? "#ffebee" : "#e8f5e9",
          borderRadius: 4
        }}>
          {message}
        </p>
      )}
      
      <div 
        ref={screenshotContainerRef}
        style={{
          marginTop: 8,
          maxHeight: 200,
          overflow: "auto",
          border: screenshotData ? "1px solid #ddd" : "none",
          borderRadius: 4
        }}
      >
        {screenshotData && (
          <img 
            src={screenshotData} 
            alt="Screenshot" 
            style={{ width: "100%", display: "block" }}
          />
        )}
      </div>
      
      <p style={{ fontSize: 12, marginTop: 8 }}>
        AI Autocomplete provides intelligent text suggestions as you type.
      </p>
    </div>
  )
}

export default IndexPopup
