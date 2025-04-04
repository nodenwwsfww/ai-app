import { useEffect, useState } from "react"

function WelcomePage() {
  const [extensionName, setExtensionName] = useState("AI Extension")

  useEffect(() => {
    // You could fetch the extension name from storage or manifest here
    const fetchExtensionInfo = async () => {
      try {
        const manifest = chrome.runtime.getManifest()
        if (manifest.name) {
          setExtensionName(manifest.name)
        }
      } catch (error) {
        console.error("Error fetching extension info:", error)
      }
    }

    fetchExtensionInfo()
  }, [])

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        maxWidth: "800px",
        margin: "0 auto",
        padding: "40px 20px",
        color: "#333"
      }}>
      <h1
        style={{
          color: "#4a86e8",
          fontSize: "28px",
          marginBottom: "20px"
        }}>
        Welcome to {extensionName}!
      </h1>

      <div
        style={{
          background: "#f5f9ff",
          borderRadius: "8px",
          padding: "24px",
          marginBottom: "24px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.05)"
        }}>
        <h2 style={{ fontSize: "20px", marginTop: 0 }}>
          Thank you for installing our extension
        </h2>
        <p>
          This extension helps you enhance your browsing experience with
          AI-powered features. Here's what you can do with it:
        </p>

        <ul style={{ lineHeight: "1.6" }}>
          <li>Access AI assistance directly in your browser</li>
          <li>Get intelligent suggestions as you browse</li>
          <li>Customize your experience in the extension settings</li>
        </ul>
      </div>

      <div
        style={{
          marginTop: "30px"
        }}>
        <h3>Getting Started</h3>
        <p>
          Click on the extension icon in your toolbar to open the main popup and
          start using the features.
        </p>
        <button
          style={{
            background: "#4a86e8",
            color: "white",
            border: "none",
            padding: "10px 20px",
            borderRadius: "4px",
            fontSize: "16px",
            cursor: "pointer",
            marginTop: "10px"
          }}
          onClick={() => window.close()}>
          Got it!
        </button>
      </div>
    </div>
  )
}

export default WelcomePage
