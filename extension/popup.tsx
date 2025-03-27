import { useState, useEffect } from "react"

function IndexPopup() {
  const [apiUrl, setApiUrl] = useState("http://localhost:8080")

  const saveSettings = () => {
    chrome.storage.local.set({ apiUrl })
  }

  // Load settings when popup opens
  useEffect(() => {
    chrome.storage.local.get("apiUrl", (data) => {
      if (data.apiUrl) {
        setApiUrl(data.apiUrl)
      }
    })
  }, [])

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
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          style={{ padding: 6, width: "100%" }}
        />
      </div>
      
      <button 
        onClick={saveSettings}
        style={{
          marginTop: 8,
          padding: "6px 12px",
          backgroundColor: "#4285f4",
          color: "white",
          border: "none",
          borderRadius: 4,
          cursor: "pointer"
        }}
      >
        Save Settings
      </button>
      
      <p style={{ fontSize: 12, marginTop: 8 }}>
        AI Autocomplete provides intelligent text suggestions as you type.
      </p>
    </div>
  )
}

export default IndexPopup
