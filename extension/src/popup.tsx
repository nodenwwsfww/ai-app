import React, { useEffect, useRef, useState } from "react"

import { STORAGE_KEYS } from "~constants" // Import constants

function IndexPopup() {
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [trialActive, setTrialActive] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [userCountry, setUserCountry] = useState("")
  const [userCity, setUserCity] = useState("")
  const [settingsMessage, setSettingsMessage] = useState("")

  const timerRef = useRef(null)

  useEffect(() => {
    // Check if trial is active and load settings
    if (chrome.storage?.local) {
      chrome.storage.local.get(
        [
          STORAGE_KEYS.TRIAL_END_TIME,
          STORAGE_KEYS.USER_COUNTRY,
          STORAGE_KEYS.USER_CITY
        ],
        (result) => {
          if (result[STORAGE_KEYS.TRIAL_END_TIME]) {
            const endTime = result[STORAGE_KEYS.TRIAL_END_TIME]
            const currentTime = Date.now()

            if (endTime > currentTime) {
              setTrialActive(true)
              setTimeRemaining(Math.floor((endTime - currentTime) / 1000))
            } else {
              chrome.storage.local.remove(STORAGE_KEYS.TRIAL_END_TIME)
            }
          }
          if (result[STORAGE_KEYS.USER_COUNTRY]) {
            setUserCountry(result[STORAGE_KEYS.USER_COUNTRY])
          }
          if (result[STORAGE_KEYS.USER_CITY]) {
            setUserCity(result[STORAGE_KEYS.USER_CITY])
          }
        }
      )
    }
  }, [])

  useEffect(() => {
    // Set up timer to count down remaining time
    if (trialActive && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current)
            setTrialActive(false)
            chrome.storage.local.remove(STORAGE_KEYS.TRIAL_END_TIME)
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
      chrome.storage.local.set(
        { [STORAGE_KEYS.TRIAL_END_TIME]: endTime },
        () => {
          setTrialActive(true)
          setTimeRemaining(Math.floor(trialDuration / 1000))
          setMessage("Trial activated successfully!")
          setLoading(false)
          setTimeout(() => setMessage(""), 2000)
        }
      )
    }
  }

  const saveSettings = () => {
    if (chrome.storage?.local) {
      chrome.storage.local.set(
        {
          [STORAGE_KEYS.USER_COUNTRY]: userCountry.trim(),
          [STORAGE_KEYS.USER_CITY]: userCity.trim()
        },
        () => {
          setSettingsMessage("Settings saved successfully!")
          setTimeout(() => setSettingsMessage(""), 2000)
        }
      )
    } else {
      setSettingsMessage("Error: Could not access storage.")
      setTimeout(() => setSettingsMessage(""), 2000)
    }
  }

  // Format remaining time as HH:MM:SS
  const formatTimeRemaining = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // Basic input styling
  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    marginBottom: "10px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    boxSizing: "border-box" as const,
    fontSize: "14px"
  }

  const labelStyle = {
    display: "block",
    marginBottom: "4px",
    fontSize: "13px",
    fontWeight: "500",
    color: "#333"
  }

  const buttonStyle = {
    padding: "10px 16px",
    backgroundColor: "#4285f4", // Google Blue
    color: "white",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 14,
    width: "100%",
    textAlign: "center" as const,
    transition: "background-color 0.2s"
  }

  const settingsButtonStyle = {
    ...buttonStyle,
    backgroundColor: "#5cb85c", // Green for save
    marginTop: "5px" // Add some space above save button
  }

  return (
    <div
      style={{
        padding: 16,
        width: 320, // Slightly wider for inputs
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", // Cleaner font
        display: "flex",
        flexDirection: "column",
        gap: 12 // Increased gap for better spacing
      }}>
      <h2
        style={{
          margin: "0 0 10px 0",
          textAlign: "center" as const,
          fontSize: "18px",
          color: "#333"
        }}>
        AI Autocomplete
      </h2>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 12,
          borderBottom: "1px solid #eee",
          paddingBottom: "15px",
          marginBottom: "5px"
        }}>
        {trialActive ? (
          <div
            style={{
              backgroundColor: "#e8f5e9",
              padding: 10,
              borderRadius: 4,
              width: "100%",
              textAlign: "center" as const,
              border: "1px solid #c8e6c9"
            }}>
            <span style={{ fontWeight: "bold", color: "#2e7d32" }}>
              Trial Active
            </span>
            <p style={{ margin: "8px 0 0 0", fontSize: "14px", color: "#333" }}>
              Time remaining: {formatTimeRemaining(timeRemaining)}
            </p>
          </div>
        ) : (
          <button
            style={buttonStyle}
            onClick={activateTrial}
            disabled={loading}>
            {loading ? "Activating..." : "Activate 3-Hour Trial"}
          </button>
        )}
        {message && (
          <p
            style={{
              fontSize: 12,
              margin: "8px 0 0 0",
              padding: "6px 10px",
              width: "100%",
              textAlign: "center" as const,
              boxSizing: "border-box" as const,
              backgroundColor: message.startsWith("Error")
                ? "#ffebee"
                : "#e8f5e9",
              color: message.startsWith("Error") ? "#c62828" : "#2e7d32",
              borderRadius: 4
            }}>
            {message}
          </p>
        )}
      </div>

      <div
        style={{
          borderBottom: "1px solid #eee",
          paddingBottom: "15px",
          marginBottom: "5px"
        }}>
        <h3
          style={{
            margin: "0 0 10px 0",
            fontSize: "15px",
            color: "#555",
            fontWeight: "600"
          }}>
          Personalization (Optional)
        </h3>
        <div>
          <label htmlFor="userCountry" style={labelStyle}>
            Country:
          </label>
          <input
            id="userCountry"
            type="text"
            style={inputStyle}
            placeholder="e.g., Lithuania"
            value={userCountry}
            onChange={(e) => setUserCountry(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="userCity" style={labelStyle}>
            City:
          </label>
          <input
            id="userCity"
            type="text"
            style={inputStyle}
            placeholder="e.g., Vilnius"
            value={userCity}
            onChange={(e) => setUserCity(e.target.value)}
          />
        </div>
        <button style={settingsButtonStyle} onClick={saveSettings}>
          Save Settings
        </button>
        {settingsMessage && (
          <p
            style={{
              fontSize: 12,
              marginTop: 8,
              padding: 6,
              textAlign: "center" as const,
              backgroundColor: settingsMessage.startsWith("Error")
                ? "#ffebee"
                : "#e8f5e9",
              color: settingsMessage.startsWith("Error")
                ? "#c62828"
                : "#2e7d32",
              borderRadius: 4
            }}>
            {settingsMessage}
          </p>
        )}
      </div>

      <p
        style={{
          fontSize: 12,
          color: "#666",
          marginTop: 8,
          textAlign: "center"
        }}>
        AI Autocomplete provides intelligent text suggestions.{" "}
        {!trialActive && " Activate the trial for full features."}{" "}
        Personalization helps improve suggestions.
      </p>
    </div>
  )
}

export default IndexPopup
