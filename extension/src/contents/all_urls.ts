import type { PlasmoCSConfig } from "plasmo"

import { IGNORE_PATTERNS, STORAGE_KEYS } from "~constants"
import {
  captureScreenshotOnce,
  copyStyles,
  debounce,
  getElementValue,
  injectGhostTextStyles,
  isSupportedElement,
  setElementValue,
  throttle
} from "~contents-helpers/web"
import type { CompleteRequest, SupportedElement } from "~types"

export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"],
  all_frames: false
}

const init = () => {
  const currentUrl = window.location.href
  if (IGNORE_PATTERNS.some((pattern) => currentUrl.includes(pattern))) {
    console.log(`@init: Ignoring page: ${currentUrl}`)
    return
  }
  console.log("@init: Running in page:", currentUrl)

  const processed = new WeakSet<Element>()

  // Observer for element resizing
  const resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const element = entry.target as Element
      const ghostText = element.nextElementSibling as HTMLElement | null // Type assertion
      if (ghostText?.classList.contains("ghost-text")) {
        copyStyles(element, ghostText) // Update styles on resize
      }
    }
  })

  // Setup function for each supported input element
  const setupInputElement = (element: SupportedElement) => {
    if (processed.has(element)) return // Already processed

    const ghostText = document.createElement("div")
    ghostText.classList.add("ghost-text")
    // Make it non-interactive for screen readers
    ghostText.setAttribute("aria-hidden", "true")

    if (element.parentNode) {
      // Insert ghost text after the element
      element.parentNode.insertBefore(ghostText, element.nextSibling)
      copyStyles(element, ghostText) // Initial style copy
      processed.add(element)
      resizeObserver.observe(element) // Observe for size changes

      // Debounced API call function
      const debouncedGetSuggestion = debounce(async (value: string) => {
        if (value.length === 0) {
          ghostText.textContent = ""
          return
        }
        try {
          // Fetch personalization settings from storage
          let userSettings = { userCountry: undefined, userCity: undefined }
          if (chrome.storage?.local) {
            userSettings = await new Promise((resolve) => {
              chrome.storage.local.get(
                [STORAGE_KEYS.USER_COUNTRY, STORAGE_KEYS.USER_CITY],
                (result) => {
                  resolve({
                    userCountry: result[STORAGE_KEYS.USER_COUNTRY] || undefined,
                    userCity: result[STORAGE_KEYS.USER_CITY] || undefined
                  })
                }
              )
            })
          }

          // Get both current and previous screenshots
          const { currentScreenshot, previousScreenshot, previousTabUrl } =
            await chrome.runtime.sendMessage({
              type: "GET_BOTH_SCREENSHOTS"
            })

          const requestBody: CompleteRequest = {
            text: value,
            url: window.location.href,
            ...(userSettings.userCountry && {
              userCountry: userSettings.userCountry
            }),
            ...(userSettings.userCity && { userCity: userSettings.userCity })
          }

          // Add current screenshot if available
          if (currentScreenshot) {
            requestBody.screenshot = currentScreenshot
          }

          // Add previous screenshot and URL if available
          if (previousScreenshot) {
            requestBody.previousScreenshot = previousScreenshot
            if (previousTabUrl) {
              requestBody.previousTabUrl = previousTabUrl
            }
          }

          const response = await fetch(process.env.PLASMO_PUBLIC_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody)
          })
          if (!response.ok) throw new Error(`API error: ${response.statusText}`)
          const { text: suggestion } = await response.json()

          // Check for model refusal or empty suggestion
          const noSuggestion =
            !suggestion ||
            suggestion.length === 0 ||
            suggestion === "[No plausible continuation]"

          // Only show suggestion if it adds something and is not a refusal
          if (!noSuggestion) {
            // Ensure suggestion doesn't just repeat the value (adjust logic if needed)
            // Current logic relies on server prompt to not repeat.
            // We add the suggestion (server should handle leading space based on context)
            ghostText.textContent = value + suggestion
          } else {
            ghostText.textContent = value // Show current value if no valid suggestion
          }
          copyStyles(element, ghostText) // Update styles after getting suggestion
        } catch (error) {
          console.error("API request error:", error)
          ghostText.textContent = value // Show current value on error
        }
      }, 500) // 500ms debounce

      // Event handler for input/changes
      const handleInput = async () => {
        const value = getElementValue(element)
        ghostText.textContent = value // Immediately update ghost text to match input
        copyStyles(element, ghostText) // Update styles on input

        if (value.length > 0) {
          await captureScreenshotOnce(chrome) // Capture screenshot on first input
          debouncedGetSuggestion(value) // Trigger suggestion fetching
        } else {
          ghostText.textContent = "" // Clear ghost text if input is empty
        }
      }

      // Throttled event handler for scroll events (Improved)
      const handleScroll = throttle(() => {
        copyStyles(element, ghostText) // Update styles/scroll on scroll (throttled)
      }, 100) // Throttle to run at most every 100ms

      // Event handler for keydown events (Tab completion, Enter clearing)
      const handleKeyDown = (e: KeyboardEvent) => {
        const currentGhostText = ghostText.textContent || ""
        const currentValue = getElementValue(element)

        // Tab completion: only if ghost text is longer than input value
        if (
          e.key === "Tab" &&
          currentGhostText.length > currentValue.length &&
          currentGhostText.startsWith(currentValue)
        ) {
          e.preventDefault()
          setElementValue(element, currentGhostText)
          // Trigger input event for frameworks/listeners
          element.dispatchEvent(new Event("input", { bubbles: true }))
          ghostText.textContent = "" // Clear ghost text after completion
        } else if (
          e.key === "Enter" &&
          !(element.tagName === "TEXTAREA" && !e.ctrlKey && !e.metaKey)
        ) {
          // Clear ghost text on Enter (except for multiline textareas without Ctrl/Meta)
          ghostText.textContent = ""
        }
        // Update styles after keydown potentially changes content/scroll
        setTimeout(() => copyStyles(element, ghostText), 0)
      }

      // Attach event listeners
      element.addEventListener("input", handleInput)
      element.addEventListener("scroll", handleScroll, { passive: true })
      element.addEventListener("keydown", handleKeyDown)
      // For contenteditable, also listen to blur to catch changes
      if (element.getAttribute("contenteditable") === "true") {
        element.addEventListener("blur", handleInput)
      }
      // Update styles on window resize (Improved)
      const throttledResizeHandler = throttle(
        () => copyStyles(element, ghostText),
        100
      ) // Throttle to run at most every 100ms
      window.addEventListener("resize", throttledResizeHandler)
    } else {
      console.warn(
        "Element has no parentNode, cannot attach ghost text:",
        element
      )
    }
  }

  // Initial processing of existing elements
  document
    .querySelectorAll('textarea, input, [contenteditable="true"]')
    .forEach((element) => {
      if (isSupportedElement(element)) {
        setupInputElement(element as SupportedElement)
      }
    })

  // Observer for dynamically added elements
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) {
          // Check if node is an Element
          // Check the node itself
          if (isSupportedElement(node)) {
            setupInputElement(node as SupportedElement)
          }
          // Check descendants of the node
          node
            .querySelectorAll('textarea, input, [contenteditable="true"]')
            .forEach((childElement) => {
              if (isSupportedElement(childElement)) {
                setupInputElement(childElement as SupportedElement)
              }
            })
        }
      })
      // Handle changes to contenteditable attribute
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "contenteditable"
      ) {
        const targetElement = mutation.target
        if (
          targetElement instanceof Element &&
          isSupportedElement(targetElement)
        ) {
          setupInputElement(targetElement as SupportedElement)
        }
      }
    })
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["contenteditable"] // Watch for changes to contenteditable
  })

  // Clear ghost text when submit buttons are clicked
  document.addEventListener(
    "click",
    (e) => {
      const target = e.target as Element
      if (
        target.tagName === "BUTTON" ||
        (target instanceof HTMLInputElement && target.type === "submit")
      ) {
        document.querySelectorAll(".ghost-text").forEach((ghost) => {
          ghost.textContent = ""
        })
      }
    },
    true
  ) // Use capture phase to potentially clear before form submission logic
}

injectGhostTextStyles()
init()
