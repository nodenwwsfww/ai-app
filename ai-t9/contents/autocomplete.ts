import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: true
}

// Debug function that dispatches events to the debug panel
function debug(message: string, data: any = {}, type: 'input' | 'success' | 'error' | 'warning' = 'input') {
  // Create and dispatch custom event
  const event = new CustomEvent('ai-autocomplete-debug', {
    detail: {
      type,
      message,
      data,
      timestamp: new Date().toISOString()
    }
  })
  window.dispatchEvent(event)

  // Show visual alert for important events
  if (type === 'error' || type === 'warning') {
    const alert = document.createElement('div')
    alert.style.position = 'fixed'
    alert.style.top = '20px'
    alert.style.right = '20px'
    alert.style.padding = '12px 20px'
    alert.style.borderRadius = '4px'
    alert.style.color = 'white'
    alert.style.zIndex = '999999'
    alert.style.fontFamily = 'system-ui, -apple-system, sans-serif'
    alert.style.fontSize = '14px'
    alert.style.backgroundColor = type === 'error' ? '#f44336' : '#ff9800'
    alert.textContent = `${type === 'error' ? '❌' : '⚠️'} ${message}`
    if (data.error) alert.textContent += `: ${data.error}`
    
    document.body.appendChild(alert)
    setTimeout(() => {
      alert.style.transition = 'opacity 0.5s'
      alert.style.opacity = '0'
      setTimeout(() => alert.remove(), 500)
    }, 3000)
  }

  // Also log to console for DevTools
  console.groupCollapsed(`%cAI Autocomplete: ${message}`, `color: ${getColorForType(type)}; font-weight: bold;`)
  console.log('Data:', data)
  console.log('Time:', new Date().toISOString())
  console.groupEnd()

  // Add performance mark
  performance.mark(`ai-autocomplete-${message}`)
}

// Helper function to get color for debug type
function getColorForType(type: 'input' | 'success' | 'error' | 'warning'): string {
  const colors = {
    input: '#2196F3',
    success: '#4CAF50',
    error: '#f44336',
    warning: '#ff9800'
  }
  return colors[type]
}

// Show hot reload indicator
function showHotReloadIndicator() {
  const indicator = document.createElement('div')
  indicator.style.position = 'fixed'
  indicator.style.bottom = '20px'
  indicator.style.right = '20px'
  indicator.style.backgroundColor = '#4CAF50'
  indicator.style.color = 'white'
  indicator.style.padding = '8px 12px'
  indicator.style.borderRadius = '4px'
  indicator.style.zIndex = '999999'
  indicator.style.opacity = '0'
  indicator.style.transition = 'opacity 0.3s'
  indicator.textContent = '✨ Extension Updated'
  
  document.body.appendChild(indicator)
  
  // Show and hide animation
  setTimeout(() => {
    indicator.style.opacity = '1'
    setTimeout(() => {
      indicator.style.opacity = '0'
      setTimeout(() => indicator.remove(), 300)
    }, 1500)
  }, 100)
}

// Call on hot reload
declare global {
  interface ImportMeta {
    hot?: {
      accept: (callback: () => void) => void
    }
  }
}

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    debug('Hot reload detected', {}, 'success')
    showHotReloadIndicator()
  })
}

// Custom debug panel in DevTools Elements panel
const debugPanel = document.createElement('div')
debugPanel.id = 'ai-autocomplete-debug'
debugPanel.setAttribute('data-testid', 'ai-autocomplete-debug')
debugPanel.style.display = 'none'
document.documentElement.appendChild(debugPanel)

// Request queue management
const requestQueue = {
  current: null as Promise<string> | null,
  lastValue: '',
  debounceTime: 800,
  minLength: 3,
  lastTypingSpeed: 0,
  typingSpeedHistory: [] as number[],
  reset() {
    this.current = null
    this.lastValue = ''
    this.lastTypingSpeed = 0
    this.typingSpeedHistory = []
  },
  
  // Calculate adaptive debounce time based on typing speed
  getAdaptiveDebounceTime() {
    if (this.typingSpeedHistory.length < 2) return this.debounceTime
    
    // Calculate average typing speed (ms between keystrokes)
    const avgSpeed = this.typingSpeedHistory.reduce((a, b) => a + b, 0) / this.typingSpeedHistory.length
    
    // Adjust debounce time based on typing speed:
    // - Fast typing (< 200ms between keys): longer debounce to avoid interruptions
    // - Medium typing (200-500ms): normal debounce
    // - Slow typing (> 500ms): shorter debounce for better responsiveness
    if (avgSpeed < 200) {
      return Math.min(this.debounceTime * 1.5, 1200) // Max 1.2s
    } else if (avgSpeed > 500) {
      return Math.max(this.debounceTime * 0.7, 600) // Min 600ms
    }
    return this.debounceTime
  },
  
  // Update typing speed history
  updateTypingSpeed(currentTime: number) {
    if (this.lastTypingSpeed) {
      const speed = currentTime - this.lastTypingSpeed
      this.typingSpeedHistory.push(speed)
      // Keep only last 5 measurements
      if (this.typingSpeedHistory.length > 5) {
        this.typingSpeedHistory.shift()
      }
    }
    this.lastTypingSpeed = currentTime
  }
}

// If you've hosted the server, update the url below
const API_URL = "http://localhost:8080"

// Context detection
interface ElementContext {
  platform?: string
  element?: string
  type?: string
  previousContent?: string
  pageContent?: string
}

// Get page content summary for context detection
function getPageContentSummary(): string {
  // Get visible text content
  const visibleText = Array.from(document.querySelectorAll('h1, h2, h3, p, article, section'))
    .map(el => el.textContent)
    .filter(Boolean)
    .join(' ')
    .slice(0, 1000) // Limit to first 1000 characters
    
  // Get meta description and keywords
  const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || ''
  const metaKeywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content') || ''
  
  // Get page title
  const title = document.title

  return `Title: ${title}
Meta description: ${metaDescription}
Meta keywords: ${metaKeywords}
Page content: ${visibleText}`
}

function detectElementContext(element: HTMLElement): ElementContext {
  const context: ElementContext = {}
  
  // Get platform from hostname
  const hostname = window.location.hostname
  const pathname = window.location.pathname
  context.platform = hostname
    .replace('www.', '')
    .split('.')
    .slice(0, -1)
    .join('.')

  // Get element context
  context.element = element.tagName.toLowerCase()
  
  // Get element type
  const type = element.getAttribute('type')
  const id = element.getAttribute('id')
  const className = element.className
  
  // Detect input type
  if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
    context.type = type || 'text'
  }
  
  // Detect social contexts
  if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
    if (className.includes('tweet-box') || className.includes('compose')) {
      context.type = 'post'
    } else if (className.includes('reply')) {
      context.type = 'reply'
    } else if (pathname.includes('/messages')) {
      context.type = 'dm'
    }
  } else if (hostname.includes('github.com')) {
    if (className.includes('comment-form') || id?.includes('comment')) {
      context.type = 'code_review'
    } else if (pathname.includes('/pull/')) {
      context.type = 'pr_description'
    } else if (pathname.includes('/issues/')) {
      context.type = 'issue_comment'
    }
  }
  
  // Detect work contexts
  if (hostname.includes('docs.google.com')) {
    context.type = 'document'
  } else if (hostname.includes('sheets.google.com')) {
    context.type = 'spreadsheet'
  } else if (hostname.includes('slides.google.com')) {
    context.type = 'presentation'
  }
  
  // Detect AI/Prompt contexts
  if (hostname.includes('chat.openai.com') || 
      hostname.includes('claude.ai') || 
      hostname.includes('bard.google.com')) {
    context.type = 'prompt'
  }
  
  // Get previous content for context
  const previousElement = element.previousElementSibling
  if (previousElement && 
      (previousElement.tagName === 'P' || 
       previousElement.tagName === 'DIV' || 
       previousElement.tagName === 'SPAN')) {
    context.previousContent = previousElement.textContent || undefined
  }

  // Add page content summary
  context.pageContent = getPageContentSummary()
  
  return context
}

// Typing speed tracker for adaptive debounce
const typingTracker = {
  lastTypingTime: 0,
  speedHistory: [] as number[],
  historySize: 5,
  baseDebounceTime: 400, // Base debounce time in ms
  minDebounceTime: 300,  // Minimum debounce time
  maxDebounceTime: 800,  // Maximum debounce time

  // Update typing speed history
  updateSpeed() {
    const now = Date.now()
    if (this.lastTypingTime) {
      const speed = now - this.lastTypingTime
      this.speedHistory.push(speed)
      if (this.speedHistory.length > this.historySize) {
        this.speedHistory.shift()
      }
    }
    this.lastTypingTime = now
  },

  // Get current debounce time based on typing speed
  getDebounceTime() {
    if (this.speedHistory.length < 2) return this.baseDebounceTime

    const avgSpeed = this.speedHistory.reduce((a, b) => a + b, 0) / this.speedHistory.length

    // Fast typing: longer debounce to avoid too many requests
    if (avgSpeed < 150) {
      return this.maxDebounceTime
    }
    // Slow typing: shorter debounce for better responsiveness
    if (avgSpeed > 400) {
      return this.minDebounceTime
    }
    // Medium typing: proportional debounce
    return Math.min(
      this.maxDebounceTime,
      Math.max(
        this.minDebounceTime,
        this.baseDebounceTime
      )
    )
  },

  reset() {
    this.lastTypingTime = 0
    this.speedHistory = []
  }
}

function handleFocusIn(event: FocusEvent) {
  const target = event.target as HTMLElement
  
  // Check if element is editable
  const isEditable = (
    target instanceof HTMLTextAreaElement || 
    target instanceof HTMLInputElement ||
    target.getAttribute('contenteditable') === 'true' ||
    target.classList.contains('test-auto-suggester') ||
    target.classList.contains('search-input') ||
    target.classList.contains('input-text')
  )

  if (!isEditable) {
    return
  }

  // Remove any existing suggestion elements
  const existingSuggestion = document.querySelector('.ai-suggestion')
  if (existingSuggestion) {
    existingSuggestion.remove()
  }

  // Create suggestion element
  const suggestionElement = document.createElement('div')
  suggestionElement.classList.add('ai-suggestion')
  
  // Position suggestion element
  const targetRect = target.getBoundingClientRect()
  suggestionElement.style.position = 'absolute'
  suggestionElement.style.top = `${targetRect.top}px`
  suggestionElement.style.left = `${targetRect.left}px`
  suggestionElement.style.width = `${targetRect.width}px`
  suggestionElement.style.height = `${targetRect.height}px`
  
  copyStyles(target, suggestionElement)
  document.body.appendChild(suggestionElement)

  // Create debounced function once
  const debounceTime = typingTracker.getDebounceTime()
  const debouncedGetSuggestion = debounce(getSuggestion, debounceTime, {
    leading: false,
    maxWait: debounceTime * 1.5
  })

  const inputHandler = () => {
    // Update typing speed
    typingTracker.updateSpeed()
    
    // Get input value
    const inputValue = target instanceof HTMLElement && 'value' in target 
      ? target.value 
      : target.textContent || ''
      
    const cursorPosition = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
      ? target.selectionStart || 0
      : getCaretPosition(target)

    const textBeforeCursor = inputValue.slice(0, cursorPosition)

    // Clear previous suggestion
    suggestionElement.textContent = ''

    // Only get suggestion if cursor at end and text meets minimum length
    if (cursorPosition === inputValue.length && textBeforeCursor.length >= 3) {
      debouncedGetSuggestion(textBeforeCursor).then(suggestion => {
        if (suggestion && (
          (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) 
            ? target.selectionStart === cursorPosition
            : getCaretPosition(target) === cursorPosition
        )) {
          suggestionElement.textContent = suggestion
          
          // Update position in case input moved
          const newRect = target.getBoundingClientRect()
          suggestionElement.style.top = `${newRect.top}px`
          suggestionElement.style.left = `${newRect.left}px`

          debug('Suggestion shown', {
            input: textBeforeCursor,
            suggestion,
            debounceTime,
            typingSpeed: typingTracker.speedHistory[typingTracker.speedHistory.length - 1]
          })
        }
      })
    }
  }

  // Handle keyboard events
  const keydownHandler = (e: KeyboardEvent) => {
    const suggestion = suggestionElement.textContent || ''
    if (!suggestion) return

    if (e.key === 'Tab') {
      e.preventDefault()
      if (target instanceof HTMLElement && 'value' in target) {
        target.value = target.value + suggestion
      } else {
        target.textContent = (target.textContent || '') + suggestion
      }
      suggestionElement.textContent = ''
      debug('Suggestion accepted', { suggestion }, 'success')
      typingTracker.reset() // Reset typing history after accepting suggestion
    }
  }

  // Clear suggestion and reset tracker on blur
  const blurHandler = () => {
    suggestionElement.remove()
    typingTracker.reset()
  }

  target.addEventListener('input', inputHandler)
  target.addEventListener('keydown', keydownHandler)
  target.addEventListener('blur', blurHandler)

  const cleanup = () => {
    target.removeEventListener('input', inputHandler)
    target.removeEventListener('keydown', keydownHandler)
    target.removeEventListener('blur', blurHandler)
    suggestionElement.remove()
    typingTracker.reset()
  }

  ;(target as any)._aiCleanup = cleanup
}

// Helper function to get caret position in contenteditable elements
function getCaretPosition(element: HTMLElement): number {
  const selection = window.getSelection()
  if (!selection || !selection.rangeCount) return 0
  
  const range = selection.getRangeAt(0)
  const preCaretRange = range.cloneRange()
  preCaretRange.selectNodeContents(element)
  preCaretRange.setEnd(range.endContainer, range.endOffset)
  return preCaretRange.toString().length
}

function copyStyles(source: HTMLElement, target: HTMLElement) {
  const computedStyle = window.getComputedStyle(source)

  const stylesToCopy = [
    "font-size",
    "font-family",
    "text-align",
    "line-height",
    "letter-spacing",
    "word-spacing",
    "text-transform",
    "padding",
    "border-width",
    "box-sizing"
  ]

  stylesToCopy.forEach(style => {
    target.style.setProperty(style, computedStyle.getPropertyValue(style))
  })

  // Set essential styles for suggestion element
  target.style.pointerEvents = "none"
  target.style.background = "none"
  target.style.color = "rgba(128, 128, 128, 0.6)"
  target.style.zIndex = "999999"  // Make sure it's above other elements
  target.style.userSelect = "none"
  target.style.whiteSpace = "pre"
  target.style.overflow = "hidden"
  target.style.textOverflow = "ellipsis"
  target.style.borderColor = "transparent"
  
  // Add slight padding to prevent text overlap
  const currentPadding = parseInt(computedStyle.getPropertyValue('padding-left')) || 0
  target.style.paddingLeft = `${currentPadding + 1}px`
}

// Listen for button clicks and clear ghost text
document.addEventListener("click", (e) => {
  if ((e.target as HTMLElement).tagName === "BUTTON") {
    debug('Button clicked', { button: (e.target as HTMLElement).tagName })
    document.querySelectorAll("[data-input-listener-added]").forEach(element => {
      const cleanup = (element as any).ghostTextCleanup
      if (cleanup) {
        cleanup()
      }
    })
  }
})

function debounce<T extends (...args: any[]) => any>(
  func: T, 
  wait: number,
  options: { 
    leading?: boolean;
    maxWait?: number;
  } = {}
): {
  (...args: Parameters<T>): ReturnType<T> | undefined;
  cancel: () => void;
  flush: () => ReturnType<T> | undefined;
} {
  let lastArgs: Parameters<T> | undefined
  let lastThis: any
  const maxWait = options.maxWait
  let result: ReturnType<T> | undefined
  let timerId: ReturnType<typeof setTimeout> | undefined
  let lastCallTime: number | undefined
  let lastInvokeTime = 0
  const leading = !!options.leading
  const maxing = typeof maxWait === 'number'

  function invokeFunc(time: number): ReturnType<T> | undefined {
    const args = lastArgs
    const thisArg = lastThis

    lastArgs = undefined
    lastThis = undefined
    lastInvokeTime = time
    result = func.apply(thisArg, args as any)
    return result
  }

  function startTimer(pendingFunc: () => void, wait: number): ReturnType<typeof setTimeout> {
    return setTimeout(pendingFunc, wait)
  }

  function trailingEdge(time: number) {
    timerId = undefined

    if (lastArgs) {
      return invokeFunc(time)
    }
    lastArgs = lastThis = undefined
    return result
  }

  function cancel() {
    if (timerId !== undefined) {
      clearTimeout(timerId)
    }
    lastArgs = lastCallTime = lastThis = timerId = undefined
  }

  function flush() {
    return timerId === undefined ? result : trailingEdge(Date.now())
  }

  function debounced(...args: Parameters<T>): ReturnType<T> | undefined {
    const time = Date.now()
    const isInvoking = shouldInvoke(time)

    lastArgs = args
    lastCallTime = time

    if (isInvoking) {
      if (timerId === undefined) {
        return leadingEdge(lastCallTime)
      }
      if (maxing) {
        // Handle invocations in a tight loop
        timerId = startTimer(timerExpired, wait)
        return invokeFunc(lastCallTime)
      }
    }
    if (timerId === undefined) {
      timerId = startTimer(timerExpired, wait)
    }
    return result
  }

  function leadingEdge(time: number) {
    lastInvokeTime = time
    timerId = startTimer(timerExpired, wait)
    return leading ? invokeFunc(time) : result
  }

  function shouldInvoke(time: number) {
    if (lastCallTime === undefined) {
      return true
    }
    const timeSinceLastCall = time - lastCallTime
    const timeSinceLastInvoke = time - lastInvokeTime

    return (
      timeSinceLastCall >= wait ||
      timeSinceLastCall < 0 ||
      (maxing && maxWait !== undefined && timeSinceLastInvoke >= maxWait)
    )
  }

  function timerExpired() {
    const time = Date.now()
    if (shouldInvoke(time)) {
      return trailingEdge(time)
    }
    timerId = startTimer(timerExpired, remainingWait(time))
  }

  function remainingWait(time: number) {
    const timeSinceLastCall = time - (lastCallTime || 0)
    const timeSinceLastInvoke = time - lastInvokeTime
    const timeWaiting = wait - timeSinceLastCall

    return maxing && maxWait !== undefined
      ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke)
      : timeWaiting
  }

  debounced.cancel = cancel
  debounced.flush = flush

  return debounced
}

// Frontend cache management
const suggestionCache = {
  cache: new Map<string, {value: string, timestamp: number}>(),
  maxSize: 100,
  ttl: 1000 * 60 * 5, // 5 minutes

  set(key: string, value: string) {
    // Remove oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    })
  },

  get(key: string): string | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.value
  },

  generateKey(inputValue: string, context: ElementContext): string {
    // Create cache key from input and relevant context
    return JSON.stringify({
      input: inputValue,
      platform: context.platform,
      type: context.type,
      element: context.element
    })
  }
}

async function getSuggestion(inputValue: string): Promise<string> {
  // Don't make requests for short inputs
  if (inputValue.length < requestQueue.minLength) {
    debug('Input too short', { length: inputValue.length }, 'warning')
    return ''
  }

  try {
    // Get current focused element and context
    const activeElement = document.activeElement as HTMLElement
    const context = detectElementContext(activeElement)
    
    // Generate cache key
    const cacheKey = suggestionCache.generateKey(inputValue, context)
    
    // Check cache first
    const cachedValue = suggestionCache.get(cacheKey)
    if (cachedValue !== null) {
      debug('Cache hit', { 
        input: inputValue,
        suggestion: cachedValue,
        context
      }, 'success')
      return cachedValue
    }

    // Don't make duplicate requests
    if (inputValue === requestQueue.lastValue && requestQueue.current) {
      debug('Using pending request', { value: inputValue }, 'success')
      return requestQueue.current
    }

    requestQueue.lastValue = inputValue
    requestQueue.current = new Promise((resolve) => {
      const makeRequest = async () => {
        debug('API Request', { 
          value: inputValue,
          context,
          cacheKey 
        })
        
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: inputValue,
            url: window.location.href,
            context
          }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const { text } = await response.json()
        
        // Cache the result
        suggestionCache.set(cacheKey, text)
        
        debug('Cache set', {
          key: cacheKey,
          value: text,
          cacheSize: suggestionCache.cache.size
        }, 'success')
        
        resolve(text)
      }
      
      makeRequest().catch(error => {
        debug('API Error', { error: (error as Error).message }, 'error')
        resolve('')
      })
    })

    return await requestQueue.current
  } catch (error) {
    debug('API Error', { error: (error as Error).message }, 'error')
    requestQueue.reset()
    return ''
  }
}

// Initialize
document.addEventListener("focusin", handleFocusIn)

// Apply to existing textareas
document.querySelectorAll("textarea").forEach((textarea) => {
  const event = new FocusEvent('focusin')
  Object.defineProperty(event, 'target', { value: textarea })
  handleFocusIn(event)
}) 