import React, { useState, useEffect, useRef } from 'react'

function IndexPopup() {
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [trialActive, setTrialActive] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [screenshotData, setScreenshotData] = useState("")
  const screenshotContainerRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    // Check if trial is active
    if (chrome.storage?.local) {
      chrome.storage.local.get(["trialEndTime"], (result) => {
        if (result.trialEndTime) {
          const endTime = result.trialEndTime
          const currentTime = Date.now()
          
          if (endTime > currentTime) {
            // Trial is still active
            setTrialActive(true)
            setTimeRemaining(Math.floor((endTime - currentTime) / 1000))
          } else {
            // Trial has expired, clean up
            chrome.storage.local.remove("trialEndTime")
          }
        }
      })
    }
  }, [])

  useEffect(() => {
    // Set up timer to count down remaining time
    if (trialActive && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current)
            setTrialActive(false)
            chrome.storage.local.remove("trialEndTime")
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [trialActive, timeRemaining])

  const activateTrial = () => {
    setLoading(true)
    
    // Set trial for 3 hours
    const trialDuration = 3 * 60 * 60 * 1000 // 3 hours in milliseconds
    const endTime = Date.now() + trialDuration
    
    if (chrome.storage?.local) {
      chrome.storage.local.set({ trialEndTime: endTime }, () => {
        setTrialActive(true)
        setTimeRemaining(Math.floor(trialDuration / 1000))
        setMessage("Trial activated successfully!")
        setLoading(false)
        setTimeout(() => setMessage(""), 2000)
      })
    }
  }

  // Format remaining time as HH:MM:SS
  const formatTimeRemaining = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
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
      
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        {trialActive ? (
          <>
            <div style={{ 
              backgroundColor: "#e8f5e9", 
              padding: 10, 
              borderRadius: 4, 
              width: "100%",
              textAlign: "center" 
            }}>
              <span style={{ fontWeight: "bold" }}>Trial Active</span>
              <p style={{ margin: "8px 0 0 0" }}>
                Time remaining: {formatTimeRemaining(timeRemaining)}
              </p>
            </div>
          </>
        ) : (
          <button 
            style={{
              padding: "10px 16px",
              backgroundColor: "#4285f4",
              color: "white",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 16,
              width: "100%"
            }}
            onClick={activateTrial}
            disabled={loading}
          >
            {loading ? "Activating..." : "Activate 3-Hour Trial"}
          </button>
        )}
      </div>
      
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
        {!trialActive && " Activate the trial to experience premium features."}
      </p>
    </div>
  )
}

export default IndexPopup
