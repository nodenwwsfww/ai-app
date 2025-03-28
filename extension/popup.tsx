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
