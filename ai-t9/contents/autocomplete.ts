import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

const API_URL = "http://localhost:8080"

// Type for the API response
interface ApiResponse {
  text?: string
  error?: string
}

class Autocomplete {
  private element: HTMLTextAreaElement | HTMLInputElement
  private overlay: HTMLTextAreaElement
  private lastInput = ""
  private minLength = 3
  private debounceTimeout: number | null = null
  private lastRequestTime = 0
  private readonly DEBOUNCE_DELAY = 300 // Shorter delay for better responsiveness
  private readonly MIN_REQUEST_INTERVAL = 800 // Reasonable throttle interval
  private localCache = new Map<string, string>()
  private readonly MIN_WORD_LENGTH = 2
  private activeRequest: {
    controller: AbortController;
    text: string;
    timestamp: number;
  } | null = null

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
    let inputTimeout: number | null = null
    
    this.element.addEventListener("input", () => {
      // Clear any existing input timeout
      if (inputTimeout) {
        window.clearTimeout(inputTimeout)
      }
      
      // Set a new timeout to handle input
      inputTimeout = window.setTimeout(() => {
        this.onInput()
      }, 50) // Small delay to batch rapid input events
    })
    
    this.element.addEventListener("keydown", (e: KeyboardEvent) => this.onKeyDown(e))
    this.element.addEventListener("blur", () => this.hideOverlay())
  }

  private onInput() {
    // Immediately cancel any existing request
    if (this.activeRequest) {
      // Don't abort if the request is more than 500ms old - let it complete
      const now = Date.now()
      const requestAge = now - this.activeRequest.timestamp
      if (requestAge < 500) {
        this.activeRequest.controller.abort()
        this.activeRequest = null
      }
    }
    
    // Clear any pending debounce
    if (this.debounceTimeout) {
      window.clearTimeout(this.debounceTimeout)
      this.debounceTimeout = null
    }
    
    // Schedule the new request
    this.debounceTimeout = window.setTimeout(() => {
      this.processInput()
    }, this.DEBOUNCE_DELAY)
  }

  private processInput() {
    const text = this.element.value
    const cursorPos = this.element.selectionStart || 0
    
    // Don't process if cursor is not at the end of the text
    if (cursorPos < text.length) {
      this.hideOverlay()
      return
    }
    
    const currentLine = text.split("\n")[text.substring(0, cursorPos).split("\n").length - 1]
    const words = currentLine.split(/\s+/)
    const lastWord = words[words.length - 1] || ""

    // Basic validation
    if (currentLine.length < this.minLength || lastWord.length < this.MIN_WORD_LENGTH) {
      this.hideOverlay()
      return
    }

    // Skip if same as last input - this is critical
    if (currentLine === this.lastInput) {
      console.debug(`[AI-T9] Skipped: Same as last input "${currentLine}"`)
      return
    }
    
    // Check local cache first
    const cached = this.localCache.get(currentLine)
    if (cached !== undefined) {
      console.debug(`[AI-T9] Local cache hit: "${currentLine}" → "${cached}"`)
      if (cached) {
        this.showCompletion(cached, cursorPos)
      }
      return
    }

    // If there's already a request for the exact same text, skip
    if (this.activeRequest && this.activeRequest.text === currentLine) {
      console.debug(`[AI-T9] Skipped: Already requesting "${currentLine}"`)
      return
    }

    // Check rate limit before proceeding
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      console.debug(`[AI-T9] Throttled: Too soon (${timeSinceLastRequest}ms < ${this.MIN_REQUEST_INTERVAL}ms)`)
      
      // Schedule a retry after the rate limit period
      setTimeout(() => {
        // Only retry if the input hasn't changed
        if (this.lastInput === currentLine) {
          this.processInput()
        }
      }, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest)
      return
    }

    // Update last input before making the request to prevent multiple identical requests
    this.lastInput = currentLine
    this.lastRequestTime = now

    // Set up the new request
    this.makeRequest(currentLine, cursorPos)
  }

  private async makeRequest(text: string, cursorPos: number) {
    // Create abort controller
    const controller = new AbortController()
    
    // Store active request details
    this.activeRequest = {
      controller,
      text,
      timestamp: Date.now()
    }

    try {
      console.debug(`[AI-T9] Requesting completion for: "${text}"`)
      
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          url: window.location.href
        }),
        signal: controller.signal
      })

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After')
        if (retryAfter) {
          console.debug(`[AI-T9] Rate limited. Retry after ${retryAfter}s`)
          this.localCache.set(text, '') // Cache as empty to prevent hammering
          return
        }
      }

      const data = await response.json() as ApiResponse

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`)
      }

      // Cache the response locally
      const completion = data.text || ''
      this.localCache.set(text, completion)

      // Only show if it's still the current input (our element's content might have changed)
      const currentText = this.element.value
      const currentCursorPos = this.element.selectionStart || 0
      const currentLineNow = currentText.split("\n")[currentText.substring(0, currentCursorPos).split("\n").length - 1]
      
      if (currentLineNow === text && completion) {
        this.showCompletion(completion, cursorPos)
        console.debug(`[AI-T9] Showing completion: "${text}" → "${completion}"`)
      }
    } catch (error) {
      // Don't log aborted requests as errors
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error(`[AI-T9] Error:`, error instanceof Error ? error.message : 'Unknown error')
      }
      this.hideOverlay()
      
      // Cache errors as empty string to prevent retries
      this.localCache.set(text, '')
    } finally {
      // Clear active request if it's still the same one
      if (this.activeRequest && this.activeRequest.controller === controller) {
        this.activeRequest = null
      }
    }
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

// Only initialize once per element
const initializedElements = new WeakSet<Element>()

document.addEventListener("focusin", (e) => {
  const target = e.target as HTMLElement
  if (!initializedElements.has(target)) {
    initAutocomplete(target)
    initializedElements.add(target)
  }
})

// Initialize existing elements only once
document.querySelectorAll("textarea, input[type='text']").forEach(element => {
  if (element instanceof HTMLElement && !initializedElements.has(element)) {
    initAutocomplete(element)
    initializedElements.add(element)
  }
})

console.debug("[AI-T9] Extension initialized")