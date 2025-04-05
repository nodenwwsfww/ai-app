import type { SupportedElement } from "../types" // Assuming types are in src/types

// Add styles for ghost text
export const injectGhostTextStyles = () => {
  const style = document.createElement("style")
  style.textContent = `
    .ghost-text-container {
      position: relative;
    }
    .ghost-text {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 1;
      color: rgba(204, 204, 204, 0.7); /* Light grey */
      background: none;
      border-color: transparent;
      border-style: solid;
      display: flex; /* Use flex for alignment */
      align-items: center; /* Vertically center content */
      white-space: pre-wrap; /* Respect whitespace and wrap */
      word-wrap: break-word; /* Break words if necessary */
      overflow: hidden; /* Hide overflow */
    }

    /* Specific styles for different input types */
    input[type="text"] + .ghost-text,
    input[type="email"] + .ghost-text,
    input[type="password"] + .ghost-text,
    input[type="search"] + .ghost-text,
    input[type="url"] + .ghost-text,
    input[type="tel"] + .ghost-text {
      text-overflow: ellipsis; /* Add ellipsis for overflow */
      justify-content: flex-start; /* Align text to the start */
      line-height: normal; /* Ensure normal line height */
    }

    textarea + .ghost-text {
      align-items: flex-start; /* Align text to top for textareas */
      display: block; /* Override flex for block behavior */
    }
  `
  document.head.appendChild(style)
}

// Helper to check if element is supported
export const isSupportedElement = (
  element: Element
): element is SupportedElement => {
  const tagName = element.tagName
  if (tagName === "TEXTAREA") return true
  if (tagName === "INPUT") {
    const inputElement = element as HTMLInputElement
    const supportedTypes = ["text", "email", "search", "url", "tel", "password"]
    return supportedTypes.includes(inputElement.type.toLowerCase())
  }
  return element.getAttribute("contenteditable") === "true"
}

// Helper to get element value
export const getElementValue = (element: SupportedElement): string => {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    return element.value
  }
  if (element.getAttribute("contenteditable") === "true") {
    return element.textContent || ""
  }
  return ""
}

// Helper to set element value
export const setElementValue = (
  element: SupportedElement,
  value: string
): void => {
  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement
  ) {
    element.value = value
  } else if (element.getAttribute("contenteditable") === "true") {
    element.textContent = value
  }
}

// Copy styles from source to target ghost element
export const copyStyles = (source: Element, target: HTMLElement) => {
  const computedStyle = window.getComputedStyle(source)
  const parent = source.parentNode as HTMLElement

  // Ensure parent is positioned relatively for absolute positioning of ghost text
  if (parent && window.getComputedStyle(parent).position === "static") {
    parent.style.position = "relative"
  }

  // Use string literal keys compatible with CSSStyleDeclaration and element.style
  const stylesToCopy = [
    "font-size",
    "font-family",
    "font-weight",
    "letter-spacing",
    "text-align",
    "text-indent",
    "text-transform",
    "padding-top",
    "padding-bottom",
    "padding-left",
    "padding-right",
    "border-top-width",
    "border-bottom-width",
    "border-left-width",
    "border-right-width",
    "box-sizing",
    "line-height",
    "margin-top",
    "margin-bottom",
    "margin-left",
    "margin-right", // Keep margins for positioning relative to parent
    "direction",
    "writing-mode",
    "vertical-align"
  ]

  stylesToCopy.forEach((styleName) => {
    // Read using getPropertyValue (safer for computed styles)
    const value = computedStyle.getPropertyValue(styleName)
    // Assign using setProperty which handles kebab-case.
    target.style.setProperty(styleName, value)
  })

  // Set dimensions explicitly
  target.style.width = `${source.clientWidth}px`
  target.style.height = `${source.clientHeight}px`

  // Match scroll position
  if (source instanceof HTMLElement) {
    // Check if source is an HTMLElement to access scroll properties
    target.scrollTop = source.scrollTop
    target.scrollLeft = source.scrollLeft
  }
}

// Debounce function
export const debounce = <T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): T => {
  let timeout: NodeJS.Timeout | null = null
  return ((...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => {
      func(...args)
      timeout = null
    }, wait)
  }) as T
}

// Throttle function
export const throttle = <T extends (...args: unknown[]) => void>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false
  return function (this: unknown, ...args: Parameters<T>): void {
    if (!inThrottle) {
      func.apply(this, args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}
