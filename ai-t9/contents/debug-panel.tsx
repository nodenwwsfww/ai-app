import React, { useState, useEffect, useRef } from "react"
import type { PlasmoCSConfig } from "plasmo"

// Debug panel styles
const panelStyles: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    width: "400px", // Increased width for better context display
    maxHeight: "500px", // Increased height
    backgroundColor: "#1a1a1a",
    color: "#fff",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    zIndex: 999999,
    fontFamily: "monospace",
    fontSize: "12px",
    overflow: "hidden",
  },
  header: {
    padding: "8px 12px",
    backgroundColor: "#2196F3",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  content: {
    padding: "8px",
    maxHeight: "450px",
    overflowY: "auto",
  },
  event: {
    marginBottom: "12px",
    padding: "8px",
    borderRadius: "4px",
    backgroundColor: "#2a2a2a",
  },
  context: {
    marginTop: "4px",
    padding: "4px 8px",
    backgroundColor: "#3a3a3a",
    borderRadius: "4px",
    fontSize: "11px",
  },
  contextItem: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: "2px",
  },
  input: { backgroundColor: "#2196F3" },
  success: { backgroundColor: "#4CAF50" },
  error: { backgroundColor: "#f44336" },
  warning: { backgroundColor: "#ff9800" },
  timestamp: {
    fontSize: "10px",
    opacity: 0.7,
  },
  toggleButton: {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    backgroundColor: "#2196F3",
    color: "white",
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
  },
  clearButton: {
    background: "none",
    border: "none",
    color: "white",
    cursor: "pointer",
    padding: "4px 8px",
    fontSize: "11px",
    opacity: 0.7,
    transition: "opacity 0.2s"
  }
}

// Event type definition
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

// Debug Panel Component
const DebugPanel = () => {
  const [isVisible, setIsVisible] = useState(false)
  const [events, setEvents] = useState<DebugEvent[]>([])
  const contentRef = useRef<HTMLDivElement>(null)
  const [hoveredButton, setHoveredButton] = useState<string | null>(null)

  // Listen for debug events
  useEffect(() => {
    const handleDebugEvent = (event: CustomEvent<DebugEvent>) => {
      setEvents(prev => [...prev.slice(-100), event.detail]) // Keep last 100 events
      
      // Auto-scroll to bottom
      if (contentRef.current) {
        contentRef.current.scrollTop = contentRef.current.scrollHeight
      }
    }

    // Register event listener
    window.addEventListener("ai-autocomplete-debug" as any, handleDebugEvent)

    return () => {
      window.removeEventListener("ai-autocomplete-debug" as any, handleDebugEvent)
    }
  }, [])

  const clearEvents = () => {
    setEvents([])
  }

  if (!isVisible) {
    return (
      <button 
        style={panelStyles.toggleButton}
        onClick={() => setIsVisible(true)}
      >
        🐛
      </button>
    )
  }

  return (
    <div style={panelStyles.container}>
      <div style={panelStyles.header}>
        <span>AI Autocomplete Debug</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={clearEvents}
            onMouseEnter={() => setHoveredButton('clear')}
            onMouseLeave={() => setHoveredButton(null)}
            style={{
              ...panelStyles.clearButton,
              opacity: hoveredButton === 'clear' ? 1 : 0.7
            }}
          >
            Clear
          </button>
          <button 
            onClick={() => setIsVisible(false)}
            onMouseEnter={() => setHoveredButton('close')}
            onMouseLeave={() => setHoveredButton(null)}
            style={{
              ...panelStyles.clearButton,
              marginLeft: '8px',
              opacity: hoveredButton === 'close' ? 1 : 0.7
            }}
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
            <div style={{ fontWeight: 'bold' }}>{event.message}</div>
            
            {/* Context information */}
            {event.data?.context && (
              <div style={panelStyles.context}>
                <div style={{ marginBottom: '4px', opacity: 0.7 }}>Context:</div>
                {Object.entries(event.data.context).map(([key, value]) => (
                  value && (
                    <div key={key} style={panelStyles.contextItem}>
                      <span style={{ opacity: 0.7 }}>{key}:</span>
                      <span>{value.toString()}</span>
                    </div>
                  )
                ))}
              </div>
            )}
            
            {/* Other event data */}
            {event.data && Object.entries(event.data)
              .filter(([key]) => key !== 'context')
              .map(([key, value]) => (
                <div key={key} style={{ marginTop: '4px', fontSize: '11px' }}>
                  <span style={{ opacity: 0.7 }}>{key}: </span>
                  {typeof value === 'object' 
                    ? <pre style={{ margin: '4px 0 0' }}>{JSON.stringify(value, null, 2)}</pre>
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