import { UI } from "~constants"
import { copyStyles } from "~contents-helpers/web"

// Interface for ghost text/suggestion overlay options
export interface SuggestionUIOptions {
  className?: string
  color?: string
  zIndex?: number
}

/**
 * Creates and attaches ghost text element to follow an input
 * Used by standard inputs, textareas, and contenteditable elements
 */
export const createGhostText = (
  targetElement: Element,
  options: SuggestionUIOptions = {}
): HTMLElement => {
  const ghostText = document.createElement("div")
  ghostText.classList.add(options.className || UI.CLASS_NAMES.GHOST_TEXT)
  ghostText.setAttribute("aria-hidden", "true") // Make non-interactive for screen readers

  // Apply styling
  ghostText.style.cssText = `
    position: absolute;
    pointer-events: none;
    z-index: ${options.zIndex || UI.Z_INDEX.GHOST_TEXT};
    color: ${options.color || UI.COLORS.GHOST_TEXT};
    font-family: inherit;
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow: hidden;
  `

  // Insert after the target element
  if (targetElement.parentNode) {
    targetElement.parentNode.insertBefore(ghostText, targetElement.nextSibling)
    copyStyles(targetElement, ghostText) // Initial style copy

    // Make parent relatively positioned if static
    const parent = targetElement.parentNode as HTMLElement
    if (window.getComputedStyle(parent).position === "static") {
      parent.style.position = "relative"
    }
  }

  return ghostText
}

/**
 * Creates floating overlay for custom editors like canvas-based apps
 * Used for Google Docs and similar applications
 */
export const createOverlay = (
  options: SuggestionUIOptions = {}
): HTMLElement => {
  const overlay = document.createElement("div")
  overlay.className = options.className || UI.CLASS_NAMES.OVERLAY

  // Apply styling
  overlay.style.cssText = `
    position: absolute;
    pointer-events: none;
    z-index: ${options.zIndex || UI.Z_INDEX.OVERLAY};
    color: ${options.color || UI.COLORS.GHOST_TEXT};
    font-family: inherit;
    white-space: pre;
    display: none;
  `

  document.body.appendChild(overlay)
  return overlay
}

/**
 * Updates the ghost text element with suggestion
 */
export const updateGhostText = (
  ghostElement: HTMLElement,
  currentValue: string,
  suggestion: string | null
): void => {
  if (suggestion) {
    ghostElement.textContent = currentValue + suggestion
    ghostElement.style.display = "block"
  } else {
    ghostElement.textContent = currentValue // Show current value if no suggestion
  }
}

/**
 * Updates the overlay element with suggestion and positions it
 */
export const updateOverlay = (
  overlay: HTMLElement,
  suggestion: string | null,
  position: { top: number; left: number },
  fontSize?: string
): void => {
  if (suggestion) {
    overlay.textContent = suggestion
    overlay.style.display = "block"
    overlay.style.top = `${position.top}px`
    overlay.style.left = `${position.left}px`

    if (fontSize) {
      overlay.style.fontSize = fontSize
    }
  } else {
    overlay.style.display = "none"
  }
}

/**
 * Clears the text from a suggestion element
 */
export const clearSuggestion = (element: HTMLElement): void => {
  element.textContent = ""
  element.style.display = "none"
}
