import type { PlasmoCSConfig } from "plasmo"

import { API, UI } from "~constants"
import { debounce } from "~contents-helpers/web"
import { getSuggestion } from "~utils/api"
import { createOverlay, updateOverlay } from "~utils/ui"

export const config: PlasmoCSConfig = {
  matches: ["https://docs.google.com/*"],
  all_frames: false
}

const init = () => {
  console.log("@init: Running in Google Docs:", window.location.href)

  // Track current editor state
  let currentText = ""
  let editor: HTMLElement | null = null
  let canvas: HTMLCanvasElement | null = null

  // Create overlay element for suggestions using shared UI component
  const overlay = createOverlay({
    zIndex: UI.Z_INDEX.OVERLAY,
    color: UI.COLORS.GHOST_TEXT
  })

  // Get text around cursor for context
  const getTextContext = (): string => {
    // Try multiple approaches to get text content

    // Approach 1: Try to get selected text
    const selection = window.getSelection()
    if (selection && selection.toString()) {
      // Get text from current paragraph or line
      const selText = selection.toString()
      const container = selection.anchorNode?.parentElement
      if (container) {
        const paragraphText = container.textContent || ""
        if (paragraphText.length > selText.length) {
          return paragraphText
        }
        return selText
      }
    }

    // Approach 2: Try to get text from DOM - match actual Google Docs structure
    const content =
      document.querySelector(".kix-paragraphrenderer") ||
      document.querySelector(".kix-page-paginated") ||
      document.querySelector(".kix-rotatingtilemanager-content")

    if (content && content.textContent) {
      return content.textContent
    }

    // Approach 3: For completely canvas-based content
    // Try to extract text from aria labels or other accessibility attributes
    const canvasContainer = document.querySelector(".kix-canvas-tile-content")
    if (canvasContainer) {
      const ariaLabels = Array.from(document.querySelectorAll("[aria-label]"))
        .map((el) => el.getAttribute("aria-label"))
        .filter(Boolean)
        .join(" ")

      if (ariaLabels) {
        return ariaLabels
      }
    }

    return currentText
  }

  // Process cursor movement and text changes
  const processEditorChanges = debounce(async () => {
    if (!editor && !canvas) return

    // Get current text context
    const textContext = getTextContext()
    if (textContext === currentText || textContext.trim().length === 0) {
      overlay.style.display = "none"
      return
    }

    currentText = textContext

    // Get suggestion using shared API
    const suggestion = await getSuggestion(currentText)

    // Get cursor position
    if (suggestion) {
      // Try different methods to get cursor position
      let cursorPosition = null

      // Method 1: Direct cursor element
      const cursorElem =
        document.querySelector(".kix-cursor") ||
        document.querySelector(".docs-text-ui-cursor-blink")

      if (cursorElem) {
        cursorPosition = cursorElem.getBoundingClientRect()
      }
      // Method 2: Use caret position from selection
      else {
        const selection = window.getSelection()
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0)
          const rect = range.getBoundingClientRect()
          if (rect.width || rect.height) {
            cursorPosition = rect
          }
        }
      }

      // If we have a cursor position, update the overlay
      if (cursorPosition) {
        // Update overlay with suggestion and position
        updateOverlay(
          overlay,
          suggestion,
          {
            top: cursorPosition.top,
            left: cursorPosition.left
          },
          editor ? window.getComputedStyle(editor).fontSize : "14px"
        )
      } else {
        // If we can't find cursor, position near the canvas
        if (canvas) {
          const canvasRect = canvas.getBoundingClientRect()
          updateOverlay(
            overlay,
            suggestion,
            {
              top: canvasRect.top + 100, // Approximately position in view
              left: canvasRect.left + 100
            },
            "14px"
          )
        } else {
          overlay.style.display = "none"
        }
      }
    } else {
      overlay.style.display = "none"
    }
  }, API.DEBOUNCE_MS)

  // Watch for DOM changes to detect editor initialization
  const setupObservers = () => {
    // Find the editor element using multiple possible selectors
    editor =
      document.querySelector(".kix-appview-editor") ||
      document.querySelector(".kix-rotatingtilemanager") ||
      document.querySelector(".docs-text-ui-viewport")

    // Find canvas element
    canvas = document.querySelector(
      ".kix-canvas-tile-content"
    ) as HTMLCanvasElement

    if (!editor && !canvas) {
      // Try again later if editor not found
      console.log("Google Docs editor not found, retrying in 1s...")
      setTimeout(setupObservers, 1000)
      return
    }

    console.log("Found Google Docs editor elements:", {
      editor: !!editor,
      canvas: !!canvas
    })

    // Track cursor position changes via selection
    document.addEventListener("selectionchange", () => {
      processEditorChanges()
    })

    // Track keyboard input
    document.addEventListener("keyup", () => {
      processEditorChanges()
    })

    // Monitor DOM changes that might indicate content updates
    const contentObserver = new MutationObserver(() => {
      processEditorChanges()
    })

    // Observe various possible content containers
    const observeTargets = [
      editor,
      canvas?.parentElement,
      document.querySelector(".kix-rotatingtilemanager-content"),
      document.querySelector(".kix-page-paginated"),
      document.querySelector(".docs-text-ui-viewport")
    ].filter(Boolean) as Element[]

    for (const target of observeTargets) {
      contentObserver.observe(target, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true
      })
    }

    // Handle tab key for accepting suggestions
    document.addEventListener("keydown", (e) => {
      if (e.key === "Tab" && overlay.style.display === "block") {
        e.preventDefault()

        // Google Docs has its own content model, so we can't directly insert text
        // Instead, simulate keyboard input or use clipboard API
        // This requires deeper integration with Google Docs APIs

        // For now, just hide the overlay
        overlay.style.display = "none"
      }
    })

    console.log("Google Docs editor integration initialized")

    // Initial processing
    processEditorChanges()
  }

  // Start initialization
  setupObservers()
}

// Initialize when DOM is fully loaded
if (document.readyState === "complete") {
  init()
} else {
  window.addEventListener("load", init)
}
