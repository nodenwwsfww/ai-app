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
  private readonly DEBOUNCE_DELAY = 800 // Reduced from 1.5s for responsiveness but still effective
  private readonly MIN_REQUEST_INTERVAL = 1500 // Reduced from 3s for better UX
  private pendingRequests = new Set<string>()
  private localCache = new Map<string, string>()
  private readonly MIN_WORD_LENGTH = 2
  private currentRequest: AbortController | null = null // Use AbortController for request cancellation
  private requestQueue: string[] = [] // Queue to manage pending requests

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

  private async onInput() {
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

    // Skip if same as last input
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

    // If there's an ongoing request for this text, don't start a new one
    if (this.pendingRequests.has(currentLine)) {
      console.debug(`[AI-T9] Already pending: "${currentLine}"`)
      return
    }

    // Add to request queue
    if (!this.requestQueue.includes(currentLine)) {
      this.requestQueue.push(currentLine)
    }

    // Clear existing timeout
    if (this.debounceTimeout) {
      window.clearTimeout(this.debounceTimeout)
    }

    // Update last input immediately to prevent simultaneous identical requests
    this.lastInput = currentLine

    // Debounce the request
    this.debounceTimeout = window.setTimeout(() => {
      this.processNextRequest()
    }, this.DEBOUNCE_DELAY)
  }

  private async processNextRequest() {
    // No requests to process
    if (this.requestQueue.length === 0) {
      return
    }

    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime

    // Throttle if requests are too frequent
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      console.debug(`[AI-T9] Throttled: Too soon (${timeSinceLastRequest}ms < ${this.MIN_REQUEST_INTERVAL}ms)`)
      setTimeout(() => this.processNextRequest(), this.MIN_REQUEST_INTERVAL - timeSinceLastRequest)
      return
    }

    // Cancel any ongoing request
    if (this.currentRequest) {
      this.currentRequest.abort()
      this.currentRequest = null
    }

    // Get the next request
    const currentLine = this.requestQueue.shift()
    if (!currentLine) return

    // Skip if it's already in the cache now
    if (this.localCache.has(currentLine)) {
      this.processNextRequest() // Process next item in queue
      return
    }

    this.lastRequestTime = now
    this.pendingRequests.add(currentLine)

    // Create a new AbortController for this request
    const controller = new AbortController()
    this.currentRequest = controller

    try {
      console.debug(`[AI-T9] Requesting completion for: "${currentLine}"`)
      
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: currentLine,
          url: window.location.href
        }),
        signal: controller.signal
      })

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After')
        if (retryAfter) {
          const retryMs = parseInt(retryAfter) * 1000
          console.debug(`[AI-T9] Rate limited. Retry after ${retryAfter}s`)
          setTimeout(() => {
            this.pendingRequests.delete(currentLine)
            // Put back in queue with lower priority
            if (!this.localCache.has(currentLine)) {
              this.requestQueue.push(currentLine)
            }
            this.processNextRequest()
          }, retryMs)
          return
        }
      }

      const data = await response.json() as ApiResponse

      // Remove from pending
      this.pendingRequests.delete(currentLine)

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`)
      }

      // Cache the response locally
      const completion = data.text || ''
      this.localCache.set(currentLine, completion)

      // Only show if it's still the current input (our element's content might have changed)
      const text = this.element.value
      const cursorPos = this.element.selectionStart || 0
      const currentLineNow = text.split("\n")[text.substring(0, cursorPos).split("\n").length - 1]
      
      if (currentLineNow === currentLine && completion) {
        this.showCompletion(completion, cursorPos)
        console.debug(`[AI-T9] Showing completion: "${currentLine}" → "${completion}"`)
      }
    } catch (error) {
      // Don't log aborted requests as errors
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error(`[AI-T9] Error:`, error instanceof Error ? error.message : 'Unknown error')
      }
      this.hideOverlay()
      this.pendingRequests.delete(currentLine)
      // Cache errors as empty string to prevent retries
      this.localCache.set(currentLine, '')
    } finally {
      if (this.currentRequest === controller) {
        this.currentRequest = null
      }
      
      // Process next request in queue after a small delay
      setTimeout(() => this.processNextRequest(), 100)
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