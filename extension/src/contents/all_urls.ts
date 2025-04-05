import type { PlasmoCSConfig } from "plasmo"

import { API, IGNORE_PATTERNS } from "~constants"
import {
  copyStyles,
  debounce,
  getElementValue,
  injectGhostTextStyles,
  isSupportedElement,
  setElementValue,
  throttle
} from "~contents-helpers/web"
import type { SupportedElement } from "~types"
import { getSuggestion } from "~utils/api"
import { clearSuggestion, createGhostText, updateGhostText } from "~utils/ui"

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

    // Create ghost text element using shared UI component
    const ghostText = createGhostText(element)

    if (element.parentNode) {
      processed.add(element)
      resizeObserver.observe(element) // Observe for size changes

      // Debounced API call function
      const debouncedGetSuggestion = debounce(async (value: string) => {
        if (value.length === 0) {
          clearSuggestion(ghostText)
          return
        }

        // Get suggestion using shared API
        const suggestion = await getSuggestion(value)

        // Update ghost text with current value and suggestion
        updateGhostText(ghostText, value, suggestion)

        // Copy styles to ensure proper display
        copyStyles(element, ghostText)
      }, API.DEBOUNCE_MS) // Use constant for debounce time

      // Event handler for input/changes
      const handleInput = async () => {
        const value = getElementValue(element)
        ghostText.textContent = value // Immediately update ghost text to match input
        copyStyles(element, ghostText) // Update styles on input

        if (value.length > 0) {
          debouncedGetSuggestion(value) // Trigger suggestion fetching
        } else {
          clearSuggestion(ghostText) // Clear ghost text if input is empty
        }
      }

      // Throttled event handler for scroll events (Improved)
      const handleScroll = throttle(() => {
        copyStyles(element, ghostText) // Update styles/scroll on scroll (throttled)
      }, API.THROTTLE_MS) // Use constant for throttle time

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
          clearSuggestion(ghostText) // Clear ghost text after completion
        } else if (
          e.key === "Enter" &&
          !(element.tagName === "TEXTAREA" && !e.ctrlKey && !e.metaKey)
        ) {
          // Clear ghost text on Enter (except for multiline textareas without Ctrl/Meta)
          clearSuggestion(ghostText)
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
        API.THROTTLE_MS
      ) // Use constant for throttle time
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
          clearSuggestion(ghost as HTMLElement)
        })
      }
    },
    true
  ) // Use capture phase to potentially clear before form submission logic
}

injectGhostTextStyles()
init()
