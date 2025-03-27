import React, { useState, useEffect, useRef } from "react"
import type { PlasmoCSConfig } from "plasmo"

const panelStyles = {
  container: {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    width: "400px",
    maxHeight: "500px",
    backgroundColor: "#1e1e1e",
    color: "#e0e0e0",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
    zIndex: 999999,
    fontFamily: "ui-monospace, monospace",
    fontSize: "12px",
    overflow: "hidden"
  },
  header: {
    padding: "10px 16px",
    backgroundColor: "#2d2d2d",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    color: "#fff",
    borderBottom: "1px solid #3d3d3d"
  },
  content: {
    padding: "12px",
    maxHeight: "450px",
    overflowY: "auto"
  },
  event: {
    marginBottom: "8px",
    padding: "10px",
    borderRadius: "6px",
    backgroundColor: "#2a2a2a",
    border: "1px solid #3d3d3d"
  },
  context: {
    marginTop: "8px",
    padding: "8px",
    backgroundColor: "#333",
    borderRadius: "4px",
    fontSize: "11px"
  },
  contextItem: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "4px",
    color: "#e0e0e0"
  },
  input: { borderColor: "#2196F3" },
  success: { borderColor: "#4CAF50" },
  error: { borderColor: "#f44336" },
  warning: { borderColor: "#ff9800" },
  timestamp: {
    fontSize: "10px",
    opacity: 0.7,
    marginBottom: "4px"
  },
  toggleButton: {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    backgroundColor: "#2d2d2d",
    color: "#fff",
    border: "none",
    borderRadius: "50%",
    width: "40px",
    height: "40px",
    cursor: "pointer",
    zIndex: 999999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "20px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    transition: "transform 0.2s",
    '&:hover': {
      transform: "scale(1.05)"
    }
  },
  button: {
    background: "none",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    padding: "4px 8px",
    fontSize: "11px",
    borderRadius: "4px",
    transition: "background-color 0.2s",
    '&:hover': {
      backgroundColor: "rgba(255,255,255,0.1)"
    }
  }
}

interface DebugEvent {
  type: "input" | "success" | "error" | "warning"
  message: string
  data?: {
    context?: {
      type?: string
      platform?: string
      element?: string
      systemPrompt?: string
      previousContent?: string
    }
    value?: string
    error?: string
    suggestion?: string
    responseTime?: string
    [key: string]: any
  }
  timestamp: string
}

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

const DebugPanel = () => {
  const [isVisible, setIsVisible] = useState(false)
  const [events, setEvents] = useState<DebugEvent[]>([])
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleDebugEvent = (event: CustomEvent<DebugEvent>) => {
      setEvents(prev => [...prev.slice(-100), event.detail])
      requestAnimationFrame(() => {
        if (contentRef.current) {
          contentRef.current.scrollTop = contentRef.current.scrollHeight
        }
      })
    }

    window.addEventListener("ai-autocomplete-debug" as any, handleDebugEvent)
    return () => window.removeEventListener("ai-autocomplete-debug" as any, handleDebugEvent)
  }, [])

  if (!isVisible) {
    return (
      <button 
        style={panelStyles.toggleButton}
        onClick={() => setIsVisible(true)}
        title="Open Debug Panel"
      >
        🐛
      </button>
    )
  }

  return (
    <div style={panelStyles.container}>
      <div style={panelStyles.header}>
        <span>Debug Panel</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={() => setEvents([])}
            style={panelStyles.button}
            title="Clear all events"
          >
            Clear
          </button>
          <button 
            onClick={() => setIsVisible(false)}
            style={panelStyles.button}
            title="Close panel"
          >
            ✕
          </button>
        </div>
      </div>

      <div style={panelStyles.content} ref={contentRef}>
        {events.map((event, index) => (
          <div 
            key={index}
            style={{
              ...panelStyles.event,
              ...(panelStyles[event.type] || {})
            }}
          >
            <div style={panelStyles.timestamp}>{event.timestamp}</div>
            <div style={{ fontWeight: 500 }}>{event.message}</div>
            
            {event.data?.context && (
              <div style={panelStyles.context}>
                {Object.entries(event.data.context).map(([key, value]) => 
                  value && (
                    <div key={key} style={panelStyles.contextItem}>
                      <span style={{ opacity: 0.7 }}>{key}:</span>
                      <span>{value.toString()}</span>
                    </div>
                  )
                )}
              </div>
            )}
            
            {event.data && Object.entries(event.data)
              .filter(([key]) => key !== 'context')
              .map(([key, value]) => (
                <div key={key} style={{ marginTop: '8px', fontSize: '11px' }}>
                  <span style={{ opacity: 0.7 }}>{key}: </span>
                  {typeof value === 'object' 
                    ? <pre style={{ margin: '4px 0 0', overflow: 'auto' }}>
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    : <span>{value.toString()}</span>
                  }
                </div>
              ))
            }
          </div>
        ))}
      </div>
    </div>
  )
}

export default DebugPanel