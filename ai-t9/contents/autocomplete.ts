import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

const API_URL = "http://localhost:8080"

class Autocomplete {
  private element: HTMLTextAreaElement | HTMLInputElement
  private overlay: HTMLTextAreaElement
  private currentRequest: Promise<any> | null = null
  private lastInput = ""
  private minLength = 3
  private debounceTimeout: number | null = null
  private lastRequestTime = 0
  private readonly DEBOUNCE_DELAY = 300 // ms
  private readonly MIN_REQUEST_INTERVAL = 1000 // ms

  constructor(element: HTMLTextAreaElement | HTMLInputElement) {
    this.element = element
    this.overlay = this.createOverlay()
    this.attachListeners()
  }

  private createOverlay(): HTMLTextAreaElement {
    const overlay = document.createElement("textarea")
    overlay.setAttribute("data-ai-t9", "overlay")
    overlay.readOnly = true
    
    const style = overlay.style
    style.position = "absolute"
    style.top = "0"
    style.left = "0"
    style.width = "100%"
    style.height = "100%"
    style.font = window.getComputedStyle(this.element).font
    style.padding = window.getComputedStyle(this.element).padding
    style.border = "none"
    style.background = "none"
    style.color = "rgba(128, 128, 128, 0.6)"
    style.pointerEvents = "none"
    style.zIndex = "999999"
    style.userSelect = "none"
    style.whiteSpace = "pre"
    style.overflow = "hidden"

    this.element.parentElement?.appendChild(overlay)
    return overlay
  }

  private attachListeners() {
    this.element.addEventListener("input", () => this.onInput())
    this.element.addEventListener("keydown", (e: KeyboardEvent) => this.onKeyDown(e))
    this.element.addEventListener("blur", () => this.hideOverlay())
  }

  private async onInput() {
    const text = this.element.value
    const cursorPos = this.element.selectionStart || 0
    const currentLine = text.split("\n")[text.substring(0, cursorPos).split("\n").length - 1]

    if (currentLine.length < this.minLength || currentLine === this.lastInput) {
      this.hideOverlay()
      return
    }

    // Clear existing timeout
    if (this.debounceTimeout) {
      window.clearTimeout(this.debounceTimeout)
    }

    // Debounce the request
    this.debounceTimeout = window.setTimeout(async () => {
      const now = Date.now()
      const timeSinceLastRequest = now - this.lastRequestTime

      // Throttle if requests are too frequent
      if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
        return
      }

      this.lastInput = currentLine
      this.lastRequestTime = now

      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: currentLine,
            url: window.location.href
          })
        })

        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()

        if (data.text && this.lastInput === currentLine) {
          const completion = data.text.slice(currentLine.length)
          if (completion) {
            this.showCompletion(completion, cursorPos)
            console.debug(`[AI-T9] Completion: "${currentLine}" → "${completion}"`)
          }
        }
      } catch (error) {
        console.error(`[AI-T9] Error:`, error instanceof Error ? error.message : 'Unknown error')
        this.hideOverlay()
      }
    }, this.DEBOUNCE_DELAY)
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === "Tab" && this.overlay.value) {
      e.preventDefault()
      const completion = this.overlay.value
      this.element.value += completion
      this.hideOverlay()
      console.debug(`[AI-T9] Accepted: "${completion}"`)
    }
  }

  private showCompletion(completion: string, cursorPos: number) {
    const style = this.overlay.style
    const metrics = this.getTextWidth(this.element.value.substring(0, cursorPos))
    style.textIndent = `${metrics}px`
    this.overlay.value = completion
  }

  private hideOverlay() {
    this.overlay.value = ""
  }

  private getTextWidth(text: string): number {
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (!context) return 0
    context.font = window.getComputedStyle(this.element).font
    return context.measureText(text).width
  }
}

function initAutocomplete(element: HTMLElement) {
  if (element instanceof HTMLTextAreaElement || 
      (element instanceof HTMLInputElement && element.type === "text")) {
    new Autocomplete(element)
  }
}

document.addEventListener("focusin", (e) => initAutocomplete(e.target as HTMLElement))

document.querySelectorAll("textarea, input[type='text']").forEach(initAutocomplete)

function debug(message: string, data: any = {}, type: 'input' | 'success' | 'error' | 'warning' = 'input') {
  const event = new CustomEvent('ai-autocomplete-debug', {
    detail: {
      type,
      message,
      data,
      timestamp: new Date().toISOString()
    }
  })
  window.dispatchEvent(event)
  console.debug(`[AI-T9] ${message}:`, data)
}

// Request queue management
const requestQueue = {
  current: null as Promise<string> | null,
  lastValue: '',
  minLength: 3,
  reset() {
    this.current = null
    this.lastValue = ''
  }
}

// Context detection
interface ElementContext {
  platform?: string
  element?: string
  type?: string
  previousContent?: string
}

function detectElementContext(element: HTMLElement): ElementContext {
  const context: ElementContext = {}
  const hostname = window.location.hostname
  const pathname = window.location.pathname
  
  // Get platform from hostname
  context.platform = hostname
    .replace('www.', '')
    .split('.')
    .slice(0, -1)
    .join('.')

  // Get element context
  context.element = element.tagName.toLowerCase()
  
  // Get element type
  if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
    context.type = element.getAttribute('type') || 'text'
  }
  
  // Detect platform-specific contexts
  if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
    context.type = pathname.includes('/messages') ? 'dm' : 'post'
  } else if (hostname.includes('github.com')) {
    if (pathname.includes('/pull/')) {
      context.type = 'pr_description'
    } else if (pathname.includes('/issues/')) {
      context.type = 'issue'
    }
  } else if (hostname.includes('docs.google.com')) {
    context.type = 'document'
  } else if (hostname.includes('mail.google.com')) {
    context.type = 'email'
  }

  return context
}

// Handle input events
async function handleInput(event: InputEvent) {
  const element = event.target as HTMLInputElement | HTMLTextAreaElement
  if (!element || !(element instanceof HTMLElement)) return

  const value = element.value || ''
  if (value.length < requestQueue.minLength || value === requestQueue.lastValue) return

  try {
    const context = detectElementContext(element)
    debug('Input detected', { value, context })

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value, context })
    })

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const suggestion = await response.text()

    debug('Suggestion received', { suggestion }, 'success')
    requestQueue.lastValue = value

  } catch (error) {
    debug('Error processing input', { error: error.message }, 'error')
    requestQueue.reset()
  }
}

// Initialize input handlers
function initializeInputHandlers() {
  const inputSelector = 'input[type="text"], input[type="search"], textarea'
  
  document.addEventListener('input', (event) => {
    if (event instanceof InputEvent && 
        event.target instanceof HTMLElement && 
        event.target.matches(inputSelector)) {
      handleInput(event)
    }
  }, true)
}

// Start the extension
initializeInputHandlers()

// Hot reload support
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    debug('Extension updated', {}, 'success')
  })
}